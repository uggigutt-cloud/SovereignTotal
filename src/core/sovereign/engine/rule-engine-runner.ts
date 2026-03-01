// engine/rule-engine-runner.ts

import type { PgLiteLike } from "../db/pglite-client";
import type {
  CaseGraphSnapshot,
  DefectDraft,
  Finding,
  Rule,
  RuleContext,
  RulePack
} from "../rules/sovereign-rulepack-api";
import { stableId, buildIndexes } from "../rules/graph-utils";
import { fnv1a32Hex, jsonStableStringify } from "../utils/hash-utils";
import { buildCaseGraphSnapshot } from "../graph/graph-builder";
import { propagateInfections } from "../graph/infection-propagator";
import { linkRemedies } from "./remedy-linker";

// ---------- helpers ----------
function isoNowFixed(): string {
  return new Date().toISOString();
}

function computeSnapshotHash(g: CaseGraphSnapshot): string {
  const payload = {
    caseId: g.caseId,
    nodes: g.nodes.map(n => ({ id: n.id, type: n.type, stage: n.stage ?? null, label: n.label, refId: n.refId, attrs: n.attrs })),
    edges: g.edges.map(e => ({ id: e.id, type: e.type, from: e.from, to: e.to, weight: e.weight, attrs: e.attrs }))
  };
  return fnv1a32Hex(jsonStableStringify(payload));
}

async function insertAudit(
  db: PgLiteLike,
  caseId: string,
  actor: string,
  action: string,
  payload: Record<string, unknown>,
  entityType?: string,
  entityId?: string
): Promise<void> {
  const entitySuffix = entityId ? `|${entityType ?? ""}|${entityId}` : "";
  const auditId = stableId("audit", [caseId, actor, action, fnv1a32Hex(jsonStableStringify(payload)) + entitySuffix]);
  await db.query(
    `
    INSERT INTO audit_events (audit_id, case_id, actor, action, payload, entity_type, entity_id)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    ON CONFLICT (audit_id) DO NOTHING
    `,
    [auditId, caseId, actor, action, jsonStableStringify(payload), entityType ?? null, entityId ?? null]
  );
}

async function ensureRulepackRow(db: PgLiteLike, rulepack: RulePack): Promise<void> {
  await db.query(
    `
    INSERT INTO rulepacks (rulepack_id, version, description)
    VALUES ($1, $2, $3)
    ON CONFLICT (rulepack_id) DO UPDATE SET version=excluded.version
    `,
    [rulepack.id, rulepack.version, `RulePack ${rulepack.id}`]
  );
}

// Populate the rules table so defects.rule_id FK constraint is satisfied.
async function ensureRuleRows(db: PgLiteLike, rules: Rule[]): Promise<void> {
  for (const rule of rules) {
    await db.query(
      `
      INSERT INTO rules (rule_id, kind, citation, summary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (rule_id) DO NOTHING
      `,
      [rule.id, rule.kind ?? "INTERNAL", rule.citation ?? rule.id, rule.description]
    );
  }
}

async function upsertFinding(db: PgLiteLike, runId: string, f: Finding): Promise<void> {
  await db.query(
    `
    INSERT INTO findings (finding_id, run_id, severity, title, details, rule_id, defect_id, node_ids, excerpt_ids)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    ON CONFLICT (finding_id) DO UPDATE
      SET severity=excluded.severity,
          title=excluded.title,
          details=excluded.details,
          rule_id=excluded.rule_id,
          defect_id=excluded.defect_id,
          node_ids=excluded.node_ids,
          excerpt_ids=excluded.excerpt_ids
    `,
    [
      f.id, runId, f.severity, f.title, f.details,
      f.ruleId ?? null, f.defectId ?? null,
      jsonStableStringify(f.nodeIds),
      jsonStableStringify(f.excerptIds)
    ]
  );
}

async function upsertDefect(db: PgLiteLike, d: DefectDraft, caseId: string): Promise<void> {
  await db.query(
    `
    INSERT INTO defects (
      defect_id, case_id, category, tier, stage, title, description, confidence, rule_id, primary_excerpt_id, meta
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    ON CONFLICT (defect_id) DO UPDATE SET
      category=excluded.category,
      tier=excluded.tier,
      stage=excluded.stage,
      title=excluded.title,
      description=excluded.description,
      confidence=excluded.confidence,
      rule_id=excluded.rule_id,
      primary_excerpt_id=excluded.primary_excerpt_id,
      meta=excluded.meta
    `,
    [
      d.defectId,
      caseId,
      d.category,
      d.tier,
      d.stage ?? null,
      d.title,
      d.description,
      d.confidence,
      d.ruleId ?? null,
      d.primaryExcerptId ?? null,
      jsonStableStringify(d.meta)
    ]
  );
}

async function ensureDefectGraphNode(db: PgLiteLike, caseId: string, defect: DefectDraft): Promise<string> {
  const nodeId = stableId("node", [caseId, "DEFECT", defect.defectId]);

  await db.query(
    `
    INSERT INTO graph_nodes (node_id, case_id, type, ref_id, stage, label, attributes)
    VALUES ($1,$2,'DEFECT',$3,$4,$5,$6::jsonb)
    ON CONFLICT (node_id) DO UPDATE SET
      stage=excluded.stage,
      label=excluded.label,
      attributes=excluded.attributes
    `,
    [
      nodeId,
      caseId,
      defect.defectId,
      defect.stage ?? null,
      defect.title,
      jsonStableStringify({
        tier: defect.tier,
        category: defect.category,
        confidence: defect.confidence,
        rule_id: defect.ruleId ?? null,
        meta: defect.meta
      })
    ]
  );

  return nodeId;
}

async function ensureInfectEdges(
  db: PgLiteLike,
  caseId: string,
  defectNodeId: string,
  infectNodeIds: string[],
  attrs: Record<string, unknown>
): Promise<void> {
  const uniqueTargets = [...new Set(infectNodeIds)].sort();
  for (const targetId of uniqueTargets) {
    const edgeId = stableId("edge", [caseId, "INFECTS", defectNodeId, targetId]);

    await db.query(
      `
      INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight, attributes)
      VALUES ($1,$2,'INFECTS',$3,$4,$5,$6::jsonb)
      ON CONFLICT (edge_id) DO UPDATE
        SET weight=excluded.weight,
            attributes=excluded.attributes
      `,
      [edgeId, caseId, defectNodeId, targetId, 1.0, jsonStableStringify(attrs)]
    );
  }
}

export interface RunSummary {
  runId: string;
  caseId: string;
  rulepackId: string;
  rulepackVersion: string;
  inputHash: string;
  outputHash: string;
  findingCount: number;
  defectCount: number;
  failedRules: string[];
  finishedAtISO: string;
}

export interface RunOptions {
  thresholds?: Partial<RuleContext["thresholds"]>;
  strictGraph?: boolean;
  replaceFindings?: boolean;
  /** Forwarded verbatim to RuleContext for R-KOMPETANSE-UNAUTHORIZED-STAGE. */
  authorityConstraints?: RuleContext["authorityConstraints"];
}

export async function runRulePackOnCase(
  db: PgLiteLike,
  caseId: string,
  rulepack: RulePack,
  opts: RunOptions = {}
): Promise<RunSummary> {
  const nowISO = isoNowFixed();

  const snapshot = await buildCaseGraphSnapshot(db, caseId, { strict: opts.strictGraph ?? true });
  const g = buildIndexes(snapshot);
  const inputHash = computeSnapshotHash(g);

  // Compute multi-hop infection set once so all rules share the propagated result.
  g.infectedSet = propagateInfections(g);

  const ctx: RuleContext = {
    nowISO,
    rulepackId: rulepack.id,
    version: rulepack.version,
    thresholds: {
      independenceMin: opts.thresholds?.independenceMin ?? 0.65,
      ewiMin: opts.thresholds?.ewiMin ?? 0.60,
      contradictionMax: opts.thresholds?.contradictionMax ?? 0.30
    },
    authorityConstraints: opts.authorityConstraints
  };

  const runId = stableId("run", [caseId, rulepack.id, rulepack.version, inputHash]);

  await ensureRulepackRow(db, rulepack);
  await ensureRuleRows(db, rulepack.rules);

  await db.query(
    `
    INSERT INTO rule_runs (run_id, case_id, rulepack_id, started_at, input_hash, stats)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    ON CONFLICT (run_id) DO UPDATE
      SET started_at=excluded.started_at,
          input_hash=excluded.input_hash,
          stats=excluded.stats
    `,
    [runId, caseId, rulepack.id, nowISO, inputHash, jsonStableStringify({ thresholds: ctx.thresholds })]
  );

  await insertAudit(db, caseId, "RULE_ENGINE", "RULE_RUN_START", {
    runId,
    rulepack: { id: rulepack.id, version: rulepack.version },
    inputHash,
    thresholds: ctx.thresholds
  });

  if (opts.replaceFindings) {
    await db.query(`DELETE FROM findings WHERE run_id = $1`, [runId]);
  }

  const allFindings: Finding[] = [];
  const allDefects: DefectDraft[] = [];
  const failedRules: string[] = [];

  for (const rule of rulepack.rules) {
    try {
      const res = rule.evaluate(g, ctx);
      res.findings.sort((a, b) => a.id.localeCompare(b.id));
      res.defectDrafts.sort((a, b) => a.defectId.localeCompare(b.defectId));
      allFindings.push(...res.findings);
      allDefects.push(...res.defectDrafts);

      await insertAudit(db, caseId, "RULE_ENGINE", "RULE_EVALUATED", {
        runId,
        ruleId: rule.id,
        findings: res.findings.length,
        defectDrafts: res.defectDrafts.length
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failedRules.push(rule.id);
      await insertAudit(db, caseId, "RULE_ENGINE", "RULE_EVALUATE_ERROR", {
        runId,
        ruleId: rule.id,
        message
      });
    }
  }

  // Upsert defects FIRST so findings can reference their defect_id via FK.
  allDefects.sort((a, b) => a.defectId.localeCompare(b.defectId));
  let defectCount = 0;

  for (const d of allDefects) {
    const conf = Math.max(0, Math.min(1, d.confidence));
    const dd: DefectDraft = { ...d, confidence: conf };

    await upsertDefect(db, dd, caseId);
    defectCount++;

    await insertAudit(db, caseId, "RULE_ENGINE", "DEFECT_CREATED", {
      runId,
      tier: dd.tier,
      category: dd.category,
      confidence: dd.confidence,
      ruleId: dd.ruleId ?? null,
      infectNodeIds: dd.infectNodeIds
    }, "defect", dd.defectId);

    const defectNodeId = await ensureDefectGraphNode(db, caseId, dd);

    await ensureInfectEdges(db, caseId, defectNodeId, dd.infectNodeIds, {
      tier: dd.tier,
      category: dd.category,
      confidence: dd.confidence,
      rule_id: dd.ruleId ?? null
    });
  }

  // Upsert findings AFTER defects so defect_id FK is satisfied.
  allFindings.sort((a, b) => a.id.localeCompare(b.id));
  for (const f of allFindings) {
    await upsertFinding(db, runId, f);
    await insertAudit(db, caseId, "RULE_ENGINE", "FINDING_CREATED", {
      runId,
      severity: f.severity,
      title: f.title,
      ruleId: f.ruleId ?? null,
      defectId: f.defectId ?? null,
      nodeIds: f.nodeIds,
      excerptIds: f.excerptIds
    }, "finding", f.id);
  }

  // Link defects to applicable remedies.
  await linkRemedies(db, caseId, allDefects);

  const outputPayload = {
    runId,
    findings: allFindings.map(f => ({ id: f.id, severity: f.severity, ruleId: f.ruleId, nodeIds: f.nodeIds, excerptIds: f.excerptIds })),
    defects: allDefects.map(d => ({ defectId: d.defectId, tier: d.tier, category: d.category, infect: d.infectNodeIds }))
  };
  const outputHash = fnv1a32Hex(jsonStableStringify(outputPayload));
  const finishedAtISO = new Date().toISOString();

  await db.query(
    `
    UPDATE rule_runs
    SET finished_at=$2, output_hash=$3, stats = (COALESCE(stats,'{}'::jsonb) || $4::jsonb)
    WHERE run_id=$1
    `,
    [runId, finishedAtISO, outputHash, jsonStableStringify({
      findingCount: allFindings.length,
      defectCount,
      failedRules
    })]
  );

  await insertAudit(db, caseId, "RULE_ENGINE", "RULE_RUN_FINISH", {
    runId,
    outputHash,
    findingCount: allFindings.length,
    defectCount,
    failedRules
  });

  return {
    runId,
    caseId,
    rulepackId: rulepack.id,
    rulepackVersion: rulepack.version,
    inputHash,
    outputHash,
    findingCount: allFindings.length,
    defectCount,
    failedRules,
    finishedAtISO
  };
}
