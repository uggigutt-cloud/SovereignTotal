// testing/engine.test.ts
// Integration test: full pipeline from DB insert → graph-populate → rule-engine → findings.

import { describe, it, expect, beforeAll } from "vitest";
import { makeTestDb } from "./make-test-db";
import {
  buildPostClosureFixture,
  buildCycleFixture,
  buildContaminationFixture,
  insertCase,
  insertNode,
  insertEdge,
} from "./fixtures";
import { populateCaseGraph } from "../graph/graph-populator";
import { normalizeGraphNodeAttributes } from "../engine/attribute-normalizer";
import { runRulePackOnCase } from "../engine/rule-engine-runner";
import { SovereignCoreRulePack } from "../rules/sovereign-core-rulepack";
import type { PgLiteLike } from "../db/pglite-client";

let db: PgLiteLike;

beforeAll(async () => {
  db = await makeTestDb();
});

// ---------------------------------------------------------------------------
// Post-closure integration
// ---------------------------------------------------------------------------
describe("Engine: post-closure pipeline", () => {
  it("graph-populator builds nodes and rule engine finds T1 defect", async () => {
    const { caseId } = await buildPostClosureFixture(db, "engine-postclosure");

    // populateCaseGraph reads from graph_nodes (already inserted by fixture helpers)
    // and returns summary — here nodes are pre-inserted so we just run the engine
    await normalizeGraphNodeAttributes(db, caseId);
    const summary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    expect(summary.findingCount).toBeGreaterThan(0);

    const defects = await db.query(
      `SELECT defect_id, category, tier FROM defects WHERE case_id = $1`,
      [caseId]
    );
    const t1Defects = (defects.rows as any[]).filter((d) => d.tier === "T1");
    expect(t1Defects.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Cycle detection integration
// ---------------------------------------------------------------------------
describe("Engine: DAG cycle pipeline", () => {
  it("detects circular reasoning across full pipeline", async () => {
    const { caseId } = await buildCycleFixture(db, "engine-cycle");

    await normalizeGraphNodeAttributes(db, caseId);
    const summary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    expect(summary.findingCount).toBeGreaterThan(0);

    const findings = await db.query(
      `SELECT finding_id, rule_id FROM findings WHERE run_id = $1`,
      [summary.runId]
    );
    const cycleFindings = (findings.rows as any[]).filter((f) =>
      f.rule_id.includes("DAG") || f.rule_id.includes("CYCLE")
    );
    expect(cycleFindings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// P1 pipeline: claim_excerpts → ASSERTS edges → R-UTREDNINGSPLIKT passes
// ---------------------------------------------------------------------------
describe("Engine: P1 pipeline ASSERTS edges", () => {
  it("R-UTREDNINGSPLIKT does NOT fire when claim_excerpts join exists", async () => {
    const caseId = "engine-p1-pass";
    await insertCase(db, caseId);

    // Insert a document
    await db.query(
      `INSERT INTO documents (doc_id, case_id, artifact_type, filename)
       VALUES ($1, $2, 'PDF', $3) ON CONFLICT DO NOTHING`,
      [`${caseId}-doc1`, caseId, "dokument.pdf"]
    );

    // Insert an excerpt
    await db.query(
      `INSERT INTO excerpts (excerpt_id, doc_id, kind, text, char_start, char_end)
       VALUES ($1, $2, 'NATIVE_TEXT', $3, 0, 100) ON CONFLICT DO NOTHING`,
      [`${caseId}-exc1`, `${caseId}-doc1`, "Fakta fra dokumentet som støtter påstanden."]
    );

    // Insert a FACT claim at stage A
    await db.query(
      `INSERT INTO claims (claim_id, case_id, claim_type, stage, claim_text, eclass)
       VALUES ($1, $2, 'FACT', 'A', $3, 'E2') ON CONFLICT DO NOTHING`,
      [`${caseId}-clm1`, caseId, "Barnet bodde hos mor fra 2020."]
    );

    // Insert claim_excerpts link (P1 pipeline)
    await db.query(
      `INSERT INTO claim_excerpts (claim_id, excerpt_id, relevance)
       VALUES ($1, $2, 0.9) ON CONFLICT DO NOTHING`,
      [`${caseId}-clm1`, `${caseId}-exc1`]
    );

    // Run populateCaseGraph (will create ASSERTS edge from claim_excerpts)
    const popSummary = await populateCaseGraph(db, caseId);
    expect(popSummary.assertsEdges).toBeGreaterThan(0);

    await normalizeGraphNodeAttributes(db, caseId);
    const runSummary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    // R-UTREDNINGSPLIKT should NOT fire because claim has an ASSERTS edge
    const findings = await db.query(
      `SELECT rule_id FROM findings WHERE run_id = $1`,
      [runSummary.runId]
    );
    const utredningsFindings = (findings.rows as any[]).filter((f) =>
      f.rule_id.includes("UTREDNING")
    );
    expect(utredningsFindings.length).toBe(0);
  });

  it("R-UTREDNINGSPLIKT FIRES when no claim_excerpts join exists for FACT claim", async () => {
    const caseId = "engine-p1-fail";
    await insertCase(db, caseId);

    // Insert a FACT claim at stage A without any supporting excerpts
    await insertNode(db, caseId, `${caseId}-clm1`, "CLAIM", `${caseId}-clm1`,
      "Påstand uten dokumentasjon", "A", { claim_type: "FACT" });

    // Do NOT insert claim_excerpts — no ASSERTS edges will be created
    const popSummary = await populateCaseGraph(db, caseId);
    expect(popSummary.assertsEdges).toBe(0);

    await normalizeGraphNodeAttributes(db, caseId);
    const runSummary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    // R-UTREDNINGSPLIKT SHOULD fire
    const findings = await db.query(
      `SELECT rule_id FROM findings WHERE run_id = $1`,
      [runSummary.runId]
    );
    const utredningsFindings = (findings.rows as any[]).filter((f) =>
      f.rule_id.includes("UTREDNING")
    );
    expect(utredningsFindings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Remedy linking
// ---------------------------------------------------------------------------
describe("Engine: remedy linking", () => {
  it("links remedies to defects after rule run", async () => {
    const { caseId } = await buildPostClosureFixture(db, "engine-remedies");

    await normalizeGraphNodeAttributes(db, caseId);
    const summary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    const remedies = await db.query(
      `SELECT dr.remedy_id FROM defect_remedies dr
       JOIN defects d ON d.defect_id = dr.defect_id
       WHERE d.case_id = $1`,
      [caseId]
    );
    // At least one remedy should be linked for a T1 HOMELESMANGEL defect
    expect((remedies.rows as any[]).length).toBeGreaterThan(0);
  });
});
