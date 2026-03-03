// testing/rules.test.ts
// Unit tests for all 8 Sovereign Core rules.
// Uses makeGraph() — no database required.

import { describe, it, expect } from "vitest";
import { makeGraph } from "./fixtures";
import { R_POST_CLOSURE_ACTIVITY } from "../rules/rules/r-post-closure-activity";
import { R_DAG_CYCLE } from "../rules/rules/r-dag-cycle";
import { R_CHAIN_CONTAMINATION } from "../rules/rules/r-chain-contamination";
import { R_BEGRUNNELSE } from "../rules/rules/r-begrunnelsesmangel";
import { R_UTREDNINGSPLIKT } from "../rules/rules/r-utredningsplikt";
import { R_KONTRADIKSJON } from "../rules/rules/r-kontradiksjon";
import { R_STAGE_REGRESSION } from "../rules/rules/r-stage-regression";
import { R_KOMPETANSEMANGEL } from "../rules/rules/r-kompetansemangel";
import type { RuleContext } from "../rules/sovereign-rulepack-api";

// ---------------------------------------------------------------------------
// Shared test context
// ---------------------------------------------------------------------------
const CTX: RuleContext = {
  nowISO: "2024-01-01T00:00:00.000Z",
  rulepackId: "test-pack",
  version: "0.0.1",
  thresholds: {
    independenceMin: 0.65,
    ewiMin: 0.60,
    contradictionMax: 0.30,
  },
};

// ---------------------------------------------------------------------------
// R-POST-CLOSURE-ACTIVITY
// ---------------------------------------------------------------------------
describe("R-POST-CLOSURE-ACTIVITY", () => {
  it("fires when there is activity after HENLEGGELSE with no NY_SAK", () => {
    const g = makeGraph("test-1", [
      { id: "closure", type: "DECISION", stage: "A", label: "Henleggelse",
        attrs: { decision_type: "HENLEGGELSE", decided_date: "2023-01-01" } },
      { id: "action", type: "CLAIM", stage: "A", label: "Handling",
        attrs: { action_flag: true, event_date: "2023-06-01" } },
    ], []);

    const result = R_POST_CLOSURE_ACTIVITY.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBeGreaterThan(0);
    expect(result.defectDrafts[0].tier).toBe("T1");
    expect(result.defectDrafts[0].category).toBe("HOMELESMANGEL");
  });

  it("does not fire when there is NY_SAK after closure", () => {
    const g = makeGraph("test-1b", [
      { id: "closure", type: "DECISION", stage: "A", label: "Henleggelse",
        attrs: { decision_type: "HENLEGGELSE", decided_date: "2023-01-01" } },
      { id: "reopen", type: "DECISION", stage: "A", label: "Gjenåpning",
        attrs: { decision_type: "NY_SAK", decided_date: "2023-03-01" } },
      { id: "action", type: "CLAIM", stage: "A", label: "Handling",
        attrs: { action_flag: true, event_date: "2023-06-01" } },
    ], []);

    const result = R_POST_CLOSURE_ACTIVITY.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });

  it("does not fire when there is no post-closure activity", () => {
    const g = makeGraph("test-1c", [
      { id: "closure", type: "DECISION", stage: "A",
        attrs: { decision_type: "HENLEGGELSE", decided_date: "2023-01-01" } },
    ], []);

    const result = R_POST_CLOSURE_ACTIVITY.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-DAG-CYCLE
// ---------------------------------------------------------------------------
describe("R-DAG-CYCLE", () => {
  it("detects a 3-node DERIVES_FROM cycle A→B→C→A", () => {
    const g = makeGraph("test-2", [
      { id: "A", type: "CLAIM" },
      { id: "B", type: "CLAIM" },
      { id: "C", type: "CLAIM" },
    ], [
      { id: "e-AB", type: "DERIVES_FROM", from: "A", to: "B" },
      { id: "e-BC", type: "DERIVES_FROM", from: "B", to: "C" },
      { id: "e-CA", type: "DERIVES_FROM", from: "C", to: "A" },
    ]);

    const result = R_DAG_CYCLE.evaluate(g, CTX);
    // R-DAG-CYCLE reports cycles as findings (no defectDrafts — cycle is structural, not a defect draft)
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].severity).toBe("CRITICAL");
  });

  it("does not fire on an acyclic graph", () => {
    const g = makeGraph("test-2b", [
      { id: "A", type: "CLAIM" },
      { id: "B", type: "CLAIM" },
      { id: "C", type: "CLAIM" },
    ], [
      { id: "e-AB", type: "DERIVES_FROM", from: "A", to: "B" },
      { id: "e-BC", type: "DERIVES_FROM", from: "B", to: "C" },
    ]);

    const result = R_DAG_CYCLE.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-BEGRUNNELSE
// ---------------------------------------------------------------------------
describe("R-BEGRUNNELSE", () => {
  it("fires on a DECISION with no VIOLATES or REFERENCES edges to RULE nodes", () => {
    const g = makeGraph("test-3", [
      { id: "dec1", type: "DECISION", stage: "D", label: "Vedtak uten hjemmel" },
    ], []);

    const result = R_BEGRUNNELSE.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(1);
    expect(result.defectDrafts[0].category).toBe("BEGRUNNELSESMANGEL");
  });

  it("does not fire when DECISION references a RULE node via REFERENCES", () => {
    const g = makeGraph("test-3b", [
      { id: "dec1", type: "DECISION", stage: "D" },
      { id: "rule1", type: "RULE" },
    ], [
      { id: "e-ref", type: "REFERENCES", from: "dec1", to: "rule1" },
    ]);

    const result = R_BEGRUNNELSE.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });

  it("does not fire when DECISION has VIOLATES edge to a RULE node", () => {
    const g = makeGraph("test-3c", [
      { id: "dec1", type: "DECISION", stage: "C" },
      { id: "rule1", type: "RULE" },
    ], [
      { id: "e-viol", type: "VIOLATES", from: "dec1", to: "rule1" },
    ]);

    const result = R_BEGRUNNELSE.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-UTREDNINGSPLIKT
// ---------------------------------------------------------------------------
describe("R-UTREDNINGSPLIKT", () => {
  it("fires on a FACT claim at stage A with no ASSERTS edge from EXCERPT", () => {
    const g = makeGraph("test-4", [
      { id: "clm1", type: "CLAIM", stage: "A",
        attrs: { claim_type: "FACT" } },
    ], []);

    const result = R_UTREDNINGSPLIKT.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(1);
    expect(result.defectDrafts[0].category).toBe("UTREDNINGSPLIKTBRUDD");
  });

  it("does not fire when a FACT claim at stage A has an ASSERTS edge from EXCERPT", () => {
    const g = makeGraph("test-4b", [
      { id: "exc1", type: "EXCERPT" },
      { id: "clm1", type: "CLAIM", stage: "A", attrs: { claim_type: "FACT" } },
    ], [
      { id: "e-asserts", type: "ASSERTS", from: "exc1", to: "clm1" },
    ]);

    const result = R_UTREDNINGSPLIKT.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });

  it("does not fire on a FACT claim at stage D (only A/B trigger the rule)", () => {
    const g = makeGraph("test-4c", [
      { id: "clm1", type: "CLAIM", stage: "D", attrs: { claim_type: "FACT" } },
    ], []);

    const result = R_UTREDNINGSPLIKT.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-KONTRADIKSJON
// ---------------------------------------------------------------------------
describe("R-KONTRADIKSJON", () => {
  it("fires on a late-stage DECISION (D-G) without any COUNTER nodes", () => {
    const g = makeGraph("test-5", [
      { id: "dec1", type: "DECISION", stage: "D" },
    ], []);

    const result = R_KONTRADIKSJON.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(1);
    expect(result.defectDrafts[0].category).toBe("KONTRADIKSJONSPARTSRETT");
  });

  it("does not fire when late-stage DECISION has a COUNTER node via COUNTERS edge", () => {
    const g = makeGraph("test-5b", [
      { id: "dec1", type: "DECISION", stage: "D" },
      { id: "ctr1", type: "COUNTER" },
    ], [
      { id: "e-counters", type: "COUNTERS", from: "dec1", to: "ctr1" },
    ]);

    const result = R_KONTRADIKSJON.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-STAGE-REGRESSION
// ---------------------------------------------------------------------------
describe("R-STAGE-REGRESSION", () => {
  it("fires when a later decision has an earlier decided_date than an earlier stage decision", () => {
    const g = makeGraph("test-6", [
      // Decision at stage D decided 2024-01-01 (later stage, but earlier date)
      { id: "dec-d", type: "DECISION", stage: "D",
        attrs: { decided_date: "2023-06-01" } },
      // Decision at stage A decided 2024-03-01 (earlier stage, but later date)
      { id: "dec-a", type: "DECISION", stage: "A",
        attrs: { decided_date: "2024-03-01" } },
    ], []);

    const result = R_STAGE_REGRESSION.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBeGreaterThan(0);
  });

  it("does not fire when decisions progress chronologically with stages", () => {
    const g = makeGraph("test-6b", [
      { id: "dec-a", type: "DECISION", stage: "A",
        attrs: { decided_date: "2023-01-01" } },
      { id: "dec-d", type: "DECISION", stage: "D",
        attrs: { decided_date: "2024-06-01" } },
    ], []);

    const result = R_STAGE_REGRESSION.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-CHAIN-CONTAMINATION
// ---------------------------------------------------------------------------
describe("R-CHAIN-CONTAMINATION", () => {
  it("fires when a derived node has low independence and low EWI with infected parent", () => {
    const g = makeGraph("test-7", [
      { id: "infected-dec", type: "DECISION",
        attrs: { infected: true, independence_score: 0.5, ewi: 0.5 } },
      { id: "derived-clm", type: "CLAIM",
        attrs: { independence_score: 0.3, ewi: 0.4 } },
    ], [
      { id: "e-derives", type: "DERIVES_FROM", from: "derived-clm", to: "infected-dec" },
    ]);

    const result = R_CHAIN_CONTAMINATION.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBeGreaterThan(0);
  });

  it("does not fire when derived node has high independence from infected parent", () => {
    const g = makeGraph("test-7b", [
      { id: "infected-dec", type: "DECISION",
        attrs: { infected: true, independence_score: 0.5, ewi: 0.5 } },
      { id: "derived-clm", type: "CLAIM",
        attrs: { independence_score: 0.90, ewi: 0.85 } },
    ], [
      { id: "e-derives", type: "DERIVES_FROM", from: "derived-clm", to: "infected-dec" },
    ]);

    const result = R_CHAIN_CONTAMINATION.evaluate(g, CTX);
    expect(result.defectDrafts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R-KOMPETANSEMANGEL
// ---------------------------------------------------------------------------
describe("R-KOMPETANSEMANGEL", () => {
  it("fires when a DECISION at stage D is made by an authority not allowed for stage D", () => {
    const ctxWithConstraints: RuleContext = {
      ...CTX,
      // constraints[stage] = array of ALLOWED authorities for that stage
      authorityConstraints: {
        "D": ["fylkesnemnda", "tingrett"],  // "barnevern-lokalt" is NOT in this list
      },
    };

    const g = makeGraph("test-8", [
      { id: "dec1", type: "DECISION", stage: "D",
        attrs: { authority: "barnevern-lokalt", decided_date: "2024-01-01" } },
    ], []);

    const result = R_KOMPETANSEMANGEL.evaluate(g, ctxWithConstraints);
    expect(result.defectDrafts.length).toBeGreaterThan(0);
    expect(result.defectDrafts[0].category).toBe("KOMPETANSEMANGEL");
  });

  it("does not fire when authority is authorized for the decision stage", () => {
    const ctxWithConstraints: RuleContext = {
      ...CTX,
      authorityConstraints: {
        "D": ["barnevern-lokalt", "fylkesnemnda"],  // "fylkesnemnda" IS in this list
      },
    };

    const g = makeGraph("test-8b", [
      { id: "dec1", type: "DECISION", stage: "D",
        attrs: { authority: "fylkesnemnda", decided_date: "2024-01-01" } },
    ], []);

    const result = R_KOMPETANSEMANGEL.evaluate(g, ctxWithConstraints);
    expect(result.defectDrafts.length).toBe(0);
  });
});
