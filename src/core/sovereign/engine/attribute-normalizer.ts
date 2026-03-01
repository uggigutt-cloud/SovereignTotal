// engine/attribute-normalizer.ts

import type { PgLiteLike } from "../db/pglite-client";
import { asJsonObject } from "../db/pglite-client";
import { stableId } from "../rules/graph-utils";
import { fnv1a32Hex, jsonStableStringify } from "../utils/hash-utils";
import type { StageCode, NodeType } from "../rules/sovereign-rulepack-api";
import { computeClaimEwi } from "./ewi-scorer";

type NodeRow = {
  node_id: string;
  type: NodeType;
  stage: StageCode | null;
  label: string;
  ref_id: string;
  attributes: Record<string, unknown>;
};

export interface NormalizerOptions {
  strict?: boolean;
  maxUpdates?: number;
}

export interface NormalizerSummary {
  caseId: string;
  updatedNodes: number;
  updates: {
    dateFilled: number;
    actionFlagSet: number;
    contradictionScoreSet: number;
    ewiSet: number;
    ewiDynamic: number;
    independenceSet: number;
  };
}


async function insertAudit(
  db: PgLiteLike,
  caseId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  const auditId = stableId("audit", [caseId, "SYSTEM", action, fnv1a32Hex(jsonStableStringify(payload))]);
  await db.query(
    `
    INSERT INTO audit_events (audit_id, case_id, actor, action, payload)
    VALUES ($1, $2, 'SYSTEM', $3, $4::jsonb)
    ON CONFLICT (audit_id) DO NOTHING
    `,
    [auditId, caseId, action, jsonStableStringify(payload)]
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISODate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const iso = `${y}-${pad2(m)}-${pad2(d)}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? iso : null;
}

function extractDateCandidates(text: string): string[] {
  const s = text;
  const out = new Set<string>();

  for (const m of s.matchAll(/\b(19\d{2}|20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const iso = toISODate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.add(iso);
  }

  for (const m of s.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](19\d{2}|20\d{2})\b/g)) {
    const iso = toISODate(Number(m[3]), Number(m[2]), Number(m[1]));
    if (iso) out.add(iso);
  }

  for (const m of s.matchAll(/\b(19\d{2}|20\d{2})[./](\d{1,2})[./](\d{1,2})\b/g)) {
    const iso = toISODate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.add(iso);
  }

  return [...out].sort();
}

function choosePrimaryDate(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  return candidates[0] ?? null;
}

const ACTION_PATTERNS: RegExp[] = [
  /\binnhent(et|e|ing)\b/i,
  /\binnkall(et|ing|else)?\b/i,
  /\bkontakt(et|e)?\b/i,
  /\btok\s+kontakt\b/i,
  /\bring(te|t)?\b/i,
  /\btelefon(er|erte|erte)?\b/i,
  /\bba\s+om\b/i,
  /\bbestilt(e|)\b/i,
  /\brekvirer(t|te|ing)\b/i,
  /\bforesp(ø|o)r(sel|te)\b/i,
  /\btilskrev\b/i,
  /\bsend(te|t)\b/i,
  /\binnkalte\b/i,
  /\bgjennomf(ø|o)r(te|t)\b/i,
  /\bobserver(te|t|ing)\b/i,
  /\bhent(et|e)\s+inn\b/i,
  /\binnsamlet\b/i,
  /\bkoordiner(te|t|ing)\b/i,
  /\bavtal(te|t)\b/i,
  /\bm(ø|o)te\b/i,
  /\bm(ø|o)tereferat\b/i
];

const ACTION_NEGATIVE: RegExp[] = [
  /\bingen\s+kontakt\b/i,
  /\bmanglende\s+kontakt\b/i,
  /\bikke\s+kontakt\b/i
];

function detectActionFlag(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  if (ACTION_NEGATIVE.some(rx => rx.test(s))) return false;
  return ACTION_PATTERNS.some(rx => rx.test(s));
}

function baselineEwi(nodeType: NodeType): number {
  switch (nodeType) {
    case "EXCERPT": return 0.55;
    case "DOCUMENT": return 0.50;
    case "CLAIM": return 0.45;
    case "DECISION": return 0.60;
    case "DEFECT": return 0.70;
    case "RULE": return 0.80;
    case "REMEDY": return 0.60;
    case "COUNTER": return 0.50;
    default: return 0.45;
  }
}

function baselineIndependence(nodeType: NodeType, stage?: StageCode | null): number {
  if (nodeType === "RULE") return 1.0;
  if (nodeType === "DEFECT") return 1.0;

  if (nodeType === "DECISION") {
    if (stage === "E" || stage === "F" || stage === "G") return 0.60;
    if (stage === "D") return 0.55;
    return 0.50;
  }

  if (nodeType === "CLAIM") {
    if (stage === "E" || stage === "F" || stage === "G") return 0.55;
    if (stage === "D") return 0.50;
    return 0.45;
  }

  return 0.50;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function shouldSetNumberAttr(attrs: Record<string, unknown>, key: string): boolean {
  const v = attrs[key];
  if (v === null || v === undefined) return true;
  if (typeof v === "number" && Number.isFinite(v)) return false;
  if (typeof v === "string") {
    const n = Number(v);
    return !Number.isFinite(n);
  }
  return true;
}

function getTextForNode(row: NodeRow): string {
  const snippet = typeof row.attributes["text_snippet"] === "string" ? (row.attributes["text_snippet"] as string) : "";
  return `${row.label}\n${snippet}`.trim();
}

async function fetchExcerptSupportCount(db: PgLiteLike, caseId: string, nodeId: string): Promise<number> {
  const res = await db.query(
    `
    SELECT COUNT(*) AS cnt
    FROM graph_edges ge
    WHERE ge.case_id = $1
      AND ge.type IN ('ASSERTS', 'SUPPORTS')
      AND ge.to_node_id = $2
      AND ge.from_node_id IN (
        SELECT node_id FROM graph_nodes WHERE case_id = $1 AND type = 'EXCERPT'
      )
    `,
    [caseId, nodeId]
  );
  const row = res.rows[0];
  if (!row) return 0;
  const cnt = row["cnt"];
  if (typeof cnt === "number") return cnt;
  if (typeof cnt === "string") return parseInt(cnt, 10) || 0;
  return 0;
}

async function fetchContradictionScore(db: PgLiteLike, caseId: string, claimNodeId: string): Promise<number> {
  try {
    const res = await db.query(
      `
      SELECT COUNT(*) AS cnt
      FROM graph_edges
      WHERE case_id = $1
        AND type = 'COUNTERS'
        AND from_node_id IN (
          SELECT to_node_id
          FROM graph_edges
          WHERE case_id = $1
            AND type = 'DERIVES_FROM'
            AND from_node_id = $2
        )
      `,
      [caseId, claimNodeId]
    );
    const row = res.rows[0];
    if (!row) return 0;
    const cnt = row["cnt"];
    const counterCount = typeof cnt === "number" ? cnt : (typeof cnt === "string" ? parseInt(cnt, 10) || 0 : 0);
    return Math.min(counterCount * 0.25, 1.0);
  } catch {
    // counters table absent (pre-v3 schema) — return 0 gracefully
    return 0;
  }
}

async function fetchGraphNodes(db: PgLiteLike, caseId: string): Promise<NodeRow[]> {
  const res = await db.query(
    `
    SELECT node_id, type, stage, label, ref_id, attributes
    FROM graph_nodes
    WHERE case_id = $1
    ORDER BY node_id ASC
    `,
    [caseId]
  );

  return res.rows.map((r) => ({
    node_id: String(r["node_id"]),
    type: String(r["type"]) as NodeType,
    stage: (r["stage"] === null || r["stage"] === undefined) ? null : (String(r["stage"]) as StageCode),
    label: String(r["label"] ?? ""),
    ref_id: String(r["ref_id"] ?? ""),
    attributes: asJsonObject(r["attributes"])
  }));
}

async function updateNodeAttrs(db: PgLiteLike, nodeId: string, attrs: Record<string, unknown>): Promise<void> {
  await db.query(
    `
    UPDATE graph_nodes
    SET attributes = $2::jsonb
    WHERE node_id = $1
    `,
    [nodeId, jsonStableStringify(attrs)]
  );
}

export async function normalizeGraphNodeAttributes(
  db: PgLiteLike,
  caseId: string,
  opts: NormalizerOptions = {}
): Promise<NormalizerSummary> {
  const strict = opts.strict ?? false;
  const maxUpdates = opts.maxUpdates ?? 10_000;

  const rows = await fetchGraphNodes(db, caseId);

  let updatedNodes = 0;
  let dateFilled = 0;
  let actionFlagSet = 0;
  let contradictionScoreSet = 0;
  let ewiSet = 0;
  let ewiDynamic = 0;
  let independenceSet = 0;

  await insertAudit(db, caseId, "NORMALIZE_START", { nodeCount: rows.length, strict });

  for (const row of rows) {
    if (updatedNodes >= maxUpdates) break;

    const attrs = { ...row.attributes };
    let changed = false;

    const text = getTextForNode(row);
    const candidates = extractDateCandidates(text);

    if (candidates.length > 0) {
      const primary = choosePrimaryDate(candidates);
      if (primary) {
        if (row.type === "DECISION") {
          if (typeof attrs["decided_date"] !== "string") { attrs["decided_date"] = primary; changed = true; dateFilled++; }
        } else if (row.type === "DOCUMENT") {
          if (typeof attrs["doc_date"] !== "string") { attrs["doc_date"] = primary; changed = true; dateFilled++; }
        } else if (row.type === "CLAIM" || row.type === "EXCERPT") {
          if (typeof attrs["event_date"] !== "string") { attrs["event_date"] = primary; changed = true; dateFilled++; }
        }
      }
    } else if (strict) {
      if (row.type === "DECISION" || row.type === "DOCUMENT") {
        const hasAnyDate =
          typeof attrs["decided_date"] === "string" ||
          typeof attrs["doc_date"] === "string" ||
          typeof attrs["event_date"] === "string";
        if (!hasAnyDate) {
          throw new Error(`Strict date mode: no date candidates for node ${row.node_id} (${row.type})`);
        }
      }
    }

    if ((row.type === "CLAIM" || row.type === "EXCERPT") && attrs["action_flag"] !== true) {
      const isAction = detectActionFlag(text);
      if (isAction) { attrs["action_flag"] = true; changed = true; actionFlagSet++; }
    }

    // For CLAIM nodes: compute contradiction_score from COUNTER nodes BEFORE EWI,
    // so that computeClaimEwi receives the correct penalty.
    if (row.type === "CLAIM" && shouldSetNumberAttr(attrs, "contradiction_score")) {
      attrs["contradiction_score"] = await fetchContradictionScore(db, caseId, row.node_id);
      changed = true;
      contradictionScoreSet++;
    }

    if (shouldSetNumberAttr(attrs, "ewi")) {
      if (row.type === "CLAIM") {
        // Dynamic EWI: use eclass + excerpt support count + contradiction score.
        const eclass = typeof attrs["eclass"] === "string" ? attrs["eclass"] : null;
        const contradScore = typeof attrs["contradiction_score"] === "number"
          ? attrs["contradiction_score"] : 0;
        const supportCount = await fetchExcerptSupportCount(db, caseId, row.node_id);
        attrs["ewi"] = computeClaimEwi(eclass, supportCount, contradScore);
        ewiDynamic++;
      } else {
        attrs["ewi"] = baselineEwi(row.type);
      }
      changed = true;
      ewiSet++;
    } else if (typeof attrs["ewi"] === "string") {
      attrs["ewi"] = clamp01(Number(attrs["ewi"]));
    }

    if (shouldSetNumberAttr(attrs, "independence_score")) { attrs["independence_score"] = baselineIndependence(row.type, row.stage); changed = true; independenceSet++; }
    else if (typeof attrs["independence_score"] === "string") attrs["independence_score"] = clamp01(Number(attrs["independence_score"]));

    if (shouldSetNumberAttr(attrs, "contradiction_score")) { attrs["contradiction_score"] = 0.0; changed = true; }
    else if (typeof attrs["contradiction_score"] === "string") attrs["contradiction_score"] = clamp01(Number(attrs["contradiction_score"]));

    if (typeof attrs["requires_review"] !== "boolean") { attrs["requires_review"] = true; changed = true; }

    if (changed) {
      await updateNodeAttrs(db, row.node_id, attrs);
      updatedNodes++;
    }
  }

  const summary: NormalizerSummary = {
    caseId,
    updatedNodes,
    updates: { dateFilled, actionFlagSet, contradictionScoreSet, ewiSet, ewiDynamic, independenceSet }
  };

  await insertAudit(db, caseId, "NORMALIZE_FINISH", summary as unknown as Record<string, unknown>);
  return summary;
}
