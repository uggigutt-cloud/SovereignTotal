// graph/graph-populator.ts
// Populates graph_nodes and graph_edges from the relational tables
// (documents, excerpts, claims, decisions) for a given case.
//
// This is the missing link between raw ingested data and the graph engine.
// Worker pipeline: populateCaseGraph → normalizeGraphNodeAttributes → runRulePackOnCase
//
// v1 scope:
//   DOCUMENT nodes  ← documents table
//   EXCERPT  nodes  ← excerpts table  + CONTAINS edges (doc → excerpt)
//   CLAIM    nodes  ← claims table
//   DECISION nodes  ← decisions table
//
// ASSERTS / DERIVES_FROM edges between claims and excerpts require the P1
// claim_excerpts join table and are not populated here.

import type { PgLiteLike, SqlRow } from "../db/pglite-client";
import { asText, asNumber } from "../db/pglite-client";
import { stableId } from "../rules/graph-utils";
import { jsonStableStringify } from "../utils/hash-utils";

export interface PopulatorSummary {
  caseId: string;
  documentNodes: number;
  excerptNodes: number;
  claimNodes: number;
  decisionNodes: number;
  counterNodes: number;
  containsEdges: number;
  countersEdges: number;
  assertsEdges: number;
  derivesFromEdges: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function upsertNode(
  db: PgLiteLike,
  nodeId: string,
  caseId: string,
  type: string,
  refId: string,
  stage: string | null,
  label: string,
  attrs: Record<string, unknown>
): Promise<void> {
  await db.query(
    `
    INSERT INTO graph_nodes (node_id, case_id, type, ref_id, stage, label, attributes)
    VALUES ($1, $2, $3::node_type, $4, $5::stage_code, $6, $7::jsonb)
    ON CONFLICT (node_id) DO UPDATE SET
      stage     = excluded.stage,
      label     = excluded.label,
      attributes = excluded.attributes
    `,
    [nodeId, caseId, type, refId, stage, label, jsonStableStringify(attrs)]
  );
}

async function upsertEdge(
  db: PgLiteLike,
  edgeId: string,
  caseId: string,
  type: string,
  fromNodeId: string,
  toNodeId: string,
  weight: number,
  attrs: Record<string, unknown>
): Promise<void> {
  await db.query(
    `
    INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight, attributes)
    VALUES ($1, $2, $3::edge_type, $4, $5, $6, $7::jsonb)
    ON CONFLICT (edge_id) DO UPDATE SET
      weight     = excluded.weight,
      attributes = excluded.attributes
    `,
    [edgeId, caseId, type, fromNodeId, toNodeId, weight, jsonStableStringify(attrs)]
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Idempotently populates graph_nodes and graph_edges for a case from its
 * relational records.  Safe to call multiple times — all writes use
 * ON CONFLICT DO UPDATE.
 */
export async function populateCaseGraph(
  db: PgLiteLike,
  caseId: string
): Promise<PopulatorSummary> {
  let documentNodes = 0;
  let excerptNodes = 0;
  let claimNodes = 0;
  let decisionNodes = 0;
  let counterNodes = 0;
  let containsEdges = 0;
  let countersEdges = 0;
  let assertsEdges = 0;
  let derivesFromEdges = 0;

  // ------------------------------------------------------------------
  // 1. DOCUMENT nodes
  // ------------------------------------------------------------------
  const docsRes = await db.query(
    `SELECT doc_id, artifact_type, stage, filename, doc_date, is_primary_source, meta
     FROM documents WHERE case_id = $1 ORDER BY doc_id ASC`,
    [caseId]
  );

  for (const r of docsRes.rows) {
    const docId = asText(r["doc_id"]);
    if (!docId) continue;

    const nodeId = stableId("node", [caseId, "DOC", docId]);
    const label = asText(r["filename"]) ?? docId;
    const stage = asText(r["stage"]);
    const attrs: Record<string, unknown> = {
      artifact_type: asText(r["artifact_type"]),
      doc_date: asText(r["doc_date"]),
      is_primary_source: r["is_primary_source"] ?? false,
      ...(r["meta"] as Record<string, unknown> ?? {})
    };

    await upsertNode(db, nodeId, caseId, "DOCUMENT", docId, stage, label, attrs);
    documentNodes++;
  }

  // ------------------------------------------------------------------
  // 2. EXCERPT nodes + CONTAINS edges from parent document
  // ------------------------------------------------------------------
  const excRes = await db.query(
    `
    SELECT e.excerpt_id, e.doc_id, e.kind, e.page_no, e.text, e.language
    FROM excerpts e
    JOIN documents d ON d.doc_id = e.doc_id
    WHERE d.case_id = $1
    ORDER BY e.excerpt_id ASC
    `,
    [caseId]
  );

  for (const r of excRes.rows) {
    const excerptId = asText(r["excerpt_id"]);
    const docId = asText(r["doc_id"]);
    if (!excerptId || !docId) continue;

    const nodeId = stableId("node", [caseId, "EXCERPT", excerptId]);
    const docNodeId = stableId("node", [caseId, "DOC", docId]);
    const text = asText(r["text"]) ?? "";
    const label = text.length > 80 ? text.slice(0, 80) + "…" : text;
    const attrs: Record<string, unknown> = {
      kind: asText(r["kind"]),
      page_no: asNumber(r["page_no"]),
      language: asText(r["language"]),
      text_snippet: text.slice(0, 500)
    };

    await upsertNode(db, nodeId, caseId, "EXCERPT", excerptId, null, label, attrs);
    excerptNodes++;

    const edgeId = stableId("edge", [caseId, "CONTAINS", docNodeId, nodeId]);
    await upsertEdge(db, edgeId, caseId, "CONTAINS", docNodeId, nodeId, 1.0, {});
    containsEdges++;
  }

  // ------------------------------------------------------------------
  // 3. CLAIM nodes
  // ------------------------------------------------------------------
  const claimsRes = await db.query(
    `SELECT claim_id, claim_type, stage, claim_text, claim_date, eclass, ewi,
            independence_score, contradiction_score, subject_ref, meta
     FROM claims WHERE case_id = $1 ORDER BY claim_id ASC`,
    [caseId]
  );

  for (const r of claimsRes.rows) {
    const claimId = asText(r["claim_id"]);
    if (!claimId) continue;

    const nodeId = stableId("node", [caseId, "CLAIM", claimId]);
    const text = asText(r["claim_text"]) ?? "";
    const label = text.length > 80 ? text.slice(0, 80) + "…" : text;
    const stage = asText(r["stage"]);
    const attrs: Record<string, unknown> = {
      claim_type: asText(r["claim_type"]),
      claim_date: asText(r["claim_date"]),
      eclass: asText(r["eclass"]),
      ewi: asNumber(r["ewi"]),
      independence_score: asNumber(r["independence_score"]),
      contradiction_score: asNumber(r["contradiction_score"]),
      subject_ref: asText(r["subject_ref"]),
      text_snippet: text.slice(0, 500),
      ...(r["meta"] as Record<string, unknown> ?? {})
    };

    await upsertNode(db, nodeId, caseId, "CLAIM", claimId, stage, label, attrs);
    claimNodes++;
  }

  // ------------------------------------------------------------------
  // 4. DECISION nodes
  // ------------------------------------------------------------------
  const decisionsRes = await db.query(
    `SELECT decision_id, stage, title, decided_date, authority, outcome, meta
     FROM decisions WHERE case_id = $1 ORDER BY decision_id ASC`,
    [caseId]
  );

  for (const r of decisionsRes.rows) {
    const decisionId = asText(r["decision_id"]);
    if (!decisionId) continue;

    const nodeId = stableId("node", [caseId, "DECISION", decisionId]);
    const label = asText(r["title"]) ?? decisionId;
    const stage = asText(r["stage"]);
    const attrs: Record<string, unknown> = {
      decided_date: asText(r["decided_date"]),
      authority: asText(r["authority"]),
      outcome: asText(r["outcome"]),
      ...(r["meta"] as Record<string, unknown> ?? {})
    };

    await upsertNode(db, nodeId, caseId, "DECISION", decisionId, stage, label, attrs);
    decisionNodes++;
  }

  // ------------------------------------------------------------------
  // 5. COUNTER nodes + COUNTERS edges from parent decision
  //    (requires schema v3 counters table — gracefully skips if absent)
  // ------------------------------------------------------------------
  try {
    const countersRes = await db.query(
      `SELECT counter_id, decision_id, counter_type, title, text, author, counter_date, meta
       FROM counters WHERE case_id = $1 ORDER BY counter_id ASC`,
      [caseId]
    );

    for (const r of countersRes.rows) {
      const counterId = asText(r["counter_id"]);
      const decisionId = asText(r["decision_id"]);
      if (!counterId || !decisionId) continue;

      const nodeId = stableId("node", [caseId, "COUNTER", counterId]);
      const decNodeId = stableId("node", [caseId, "DECISION", decisionId]);
      const text = asText(r["text"]) ?? "";
      const label = asText(r["title"]) ?? counterId;
      const attrs: Record<string, unknown> = {
        counter_type: asText(r["counter_type"]),
        author: asText(r["author"]),
        counter_date: asText(r["counter_date"]),
        text_snippet: text.slice(0, 500),
        ...(r["meta"] as Record<string, unknown> ?? {})
      };

      await upsertNode(db, nodeId, caseId, "COUNTER", counterId, null, label, attrs);
      counterNodes++;

      const edgeId = stableId("edge", [caseId, "COUNTERS", decNodeId, nodeId]);
      await upsertEdge(db, edgeId, caseId, "COUNTERS", decNodeId, nodeId, 1.0, {});
      countersEdges++;
    }
  } catch {
    // counters table absent (pre-v3 schema) — silently skip
  }

  // ------------------------------------------------------------------
  // 6. ASSERTS edges from claim_excerpts join table (P1 pipeline)
  //    excerpt_node → claim_node  (this excerpt supports this claim)
  //    Gracefully skips if claim_excerpts table is absent (pre-v5 schema).
  // ------------------------------------------------------------------
  try {
    const ceRes = await db.query(
      `
      SELECT ce.claim_id, ce.excerpt_id, ce.relevance
      FROM claim_excerpts ce
      JOIN claims c ON c.claim_id = ce.claim_id
      WHERE c.case_id = $1
      `,
      [caseId]
    );

    for (const r of ceRes.rows) {
      const claimId = asText(r["claim_id"]);
      const excerptId = asText(r["excerpt_id"]);
      const relevance = asNumber(r["relevance"]) ?? 1.0;
      if (!claimId || !excerptId) continue;

      const excerptNodeId = stableId("node", [caseId, "EXCERPT", excerptId]);
      const claimNodeId   = stableId("node", [caseId, "CLAIM",  claimId]);
      const edgeId = stableId("edge", [caseId, "ASSERTS", excerptNodeId, claimNodeId]);

      await upsertEdge(db, edgeId, caseId, "ASSERTS", excerptNodeId, claimNodeId, relevance, {});
      assertsEdges++;
    }
  } catch {
    // claim_excerpts table absent (pre-v5 schema) — silently skip
  }

  // ------------------------------------------------------------------
  // 7. DERIVES_FROM edges from claim_derives join table (P1 pipeline)
  //    child_claim_node → parent_claim_node
  //    Gracefully skips if claim_derives table is absent (pre-v5 schema).
  // ------------------------------------------------------------------
  try {
    const cdRes = await db.query(
      `
      SELECT cd.child_claim_id, cd.parent_claim_id
      FROM claim_derives cd
      JOIN claims c ON c.claim_id = cd.child_claim_id
      WHERE c.case_id = $1
      `,
      [caseId]
    );

    for (const r of cdRes.rows) {
      const childId  = asText(r["child_claim_id"]);
      const parentId = asText(r["parent_claim_id"]);
      if (!childId || !parentId) continue;

      const childNodeId  = stableId("node", [caseId, "CLAIM", childId]);
      const parentNodeId = stableId("node", [caseId, "CLAIM", parentId]);
      const edgeId = stableId("edge", [caseId, "DERIVES_FROM", childNodeId, parentNodeId]);

      await upsertEdge(db, edgeId, caseId, "DERIVES_FROM", childNodeId, parentNodeId, 1.0, {});
      derivesFromEdges++;
    }
  } catch {
    // claim_derives table absent (pre-v5 schema) — silently skip
  }

  return {
    caseId,
    documentNodes,
    excerptNodes,
    claimNodes,
    decisionNodes,
    counterNodes,
    containsEdges,
    countersEdges,
    assertsEdges,
    derivesFromEdges
  };
}
