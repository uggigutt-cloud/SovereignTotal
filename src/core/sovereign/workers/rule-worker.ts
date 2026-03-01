// workers/rule-worker.ts
// Web Worker that owns its own PGLite instance and runs the full
// normalise → rule-engine pipeline off the main thread.
//
// IMPORTANT: PGLite instances cannot be serialised through postMessage.
// The worker creates its own PGLite internally from the schemaSQL string
// sent in the INIT_DB message.
/// <reference lib="webworker" />

import type { PgLiteLike } from "../db/pglite-client";
import { asText, asNumber, asJsonObject } from "../db/pglite-client";
import { initSchema } from "../db/init-schema";
import type { ExecPgLike } from "../db/init-schema";
import { normalizeGraphNodeAttributes } from "../engine/attribute-normalizer";
import { runRulePackOnCase } from "../engine/rule-engine-runner";
import { SovereignCoreRulePack } from "../rules/sovereign-core-rulepack";
import { buildCaseGraphSnapshot } from "../graph/graph-builder";
import { propagateInfections } from "../graph/infection-propagator";
import { buildGraphViewModel } from "../graph/graph-view-model";
import { getAuditTrail, getRunTrace } from "../engine/trace-query";
import { jsonStableStringify } from "../utils/hash-utils";
import { populateCaseGraph } from "../graph/graph-populator";
import type {
  WorkerInMsg, WorkerOutMsg,
  CaseRow, FindingRow, DefectRow, RemedyRow
} from "./worker-protocol";

let db: PgLiteLike | null = null;

function ok(id: string, payload: unknown): void {
  const msg: WorkerOutMsg = { type: "QUERY_OK", id, payload };
  self.postMessage(msg);
}

function err(id: string | undefined, message: string): void {
  const msg: WorkerOutMsg = { type: "ERROR", id, payload: { message } };
  self.postMessage(msg);
}

self.onmessage = async (ev: MessageEvent<WorkerInMsg>) => {
  const msg = ev.data;

  try {
    // ---- INIT_DB ----
    if (msg.type === "INIT_DB") {
      const { PGlite } = await import("@electric-sql/pglite");
      const pglite = msg.payload.dbPath
        ? new PGlite(msg.payload.dbPath)
        : new PGlite();

      await initSchema(pglite as unknown as ExecPgLike, msg.payload.schemaSQL);

      for (const extra of msg.payload.extraSchemas ?? []) {
        await initSchema(pglite as unknown as ExecPgLike, extra);
      }

      db = pglite as unknown as PgLiteLike;
      const out: WorkerOutMsg = { type: "INIT_OK" };
      self.postMessage(out);
      return;
    }

    // ---- RUN_RULEPACK ----
    if (msg.type === "RUN_RULEPACK") {
      if (!db) throw new Error("DB not initialized — send INIT_DB first");
      const { caseId, thresholds } = msg.payload;

      const normSummary = await normalizeGraphNodeAttributes(db, caseId, { strict: false });
      const normOut: WorkerOutMsg = { type: "NORMALIZE_OK", payload: normSummary };
      self.postMessage(normOut);

      const summary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
        thresholds,
        strictGraph: true,
        replaceFindings: false
      });

      const runOut: WorkerOutMsg = { type: "RUN_OK", payload: summary };
      self.postMessage(runOut);
      return;
    }

    // ---- CRUD: all require an `id` for correlation ----
    if (!("id" in msg)) {
      self.postMessage({ type: "ERROR", payload: { message: "Unknown message type" } } as WorkerOutMsg);
      return;
    }

    const id = (msg as { id: string }).id;

    if (!db) {
      err(id, "DB not initialized — send INIT_DB first");
      return;
    }

    // ---- CREATE_CASE ----
    if (msg.type === "CREATE_CASE") {
      const { caseId, title, jurisdiction, notes } = msg.payload;
      await db.query(
        `INSERT INTO cases (case_id, title, locale, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (case_id) DO NOTHING`,
        [caseId, title, jurisdiction ?? "nb-NO", notes ?? null]
      );
      ok(id, { caseId });
      return;
    }

    // ---- LIST_CASES ----
    if (msg.type === "LIST_CASES") {
      const res = await db.query(
        `SELECT case_id, title, created_at, updated_at, locale, notes
         FROM cases
         ORDER BY created_at DESC`
      );
      const rows: CaseRow[] = res.rows.map(r => ({
        caseId:    asText(r["case_id"])    ?? "",
        title:     asText(r["title"])      ?? "",
        createdAt: asText(r["created_at"]) ?? "",
        updatedAt: asText(r["updated_at"]) ?? "",
        locale:    asText(r["locale"])     ?? "nb-NO",
        notes:     r["notes"] != null ? (asText(r["notes"]) ?? null) : null,
      }));
      ok(id, rows);
      return;
    }

    // ---- GET_CASE ----
    if (msg.type === "GET_CASE") {
      const { caseId } = msg.payload;
      const res = await db.query(
        `SELECT case_id, title, created_at, updated_at, locale, notes
         FROM cases WHERE case_id = $1`,
        [caseId]
      );
      const row = res.rows[0];
      if (!row) { err(id, `Case not found: ${caseId}`); return; }
      const caseRow: CaseRow = {
        caseId:    asText(row["case_id"])    ?? "",
        title:     asText(row["title"])      ?? "",
        createdAt: asText(row["created_at"]) ?? "",
        updatedAt: asText(row["updated_at"]) ?? "",
        locale:    asText(row["locale"])     ?? "nb-NO",
        notes:     row["notes"] != null ? (asText(row["notes"]) ?? null) : null,
      };
      ok(id, caseRow);
      return;
    }

    // ---- INSERT_GRAPH_NODE ----
    if (msg.type === "INSERT_GRAPH_NODE") {
      const { caseId, nodeId, nodeType, refId, label, stage, attrs } = msg.payload;
      await db.query(
        `INSERT INTO graph_nodes (node_id, case_id, type, ref_id, stage, label, attributes)
         VALUES ($1, $2, $3::node_type, $4, $5::stage_code, $6, $7::jsonb)
         ON CONFLICT (node_id) DO UPDATE
           SET label=excluded.label, attributes=excluded.attributes`,
        [nodeId, caseId, nodeType, refId, stage ?? null, label, jsonStableStringify(attrs ?? {})]
      );
      ok(id, { nodeId });
      return;
    }

    // ---- INSERT_GRAPH_EDGE ----
    if (msg.type === "INSERT_GRAPH_EDGE") {
      const { caseId, edgeId, edgeType, fromNodeId, toNodeId, weight } = msg.payload;
      await db.query(
        `INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight)
         VALUES ($1, $2, $3::edge_type, $4, $5, $6)
         ON CONFLICT (edge_id) DO NOTHING`,
        [edgeId, caseId, edgeType, fromNodeId, toNodeId, weight ?? 1.0]
      );
      ok(id, { edgeId });
      return;
    }

    // ---- GET_GRAPH_VIEW ----
    if (msg.type === "GET_GRAPH_VIEW") {
      const { caseId } = msg.payload;
      const snapshot = await buildCaseGraphSnapshot(db, caseId, { strict: false });
      propagateInfections(snapshot);
      const vm = buildGraphViewModel(snapshot);
      ok(id, vm);
      return;
    }

    // ---- GET_FINDINGS ----
    if (msg.type === "GET_FINDINGS") {
      const { caseId } = msg.payload;
      const res = await db.query(
        `SELECT f.finding_id, f.run_id, f.severity, f.title, f.details,
                f.rule_id, f.defect_id, f.node_ids, f.excerpt_ids, f.created_at
         FROM findings f
         JOIN rule_runs rr ON rr.run_id = f.run_id
         WHERE rr.case_id = $1
         ORDER BY f.created_at DESC`,
        [caseId]
      );
      const rows: FindingRow[] = res.rows.map(r => ({
        findingId:  asText(r["finding_id"])  ?? "",
        runId:      asText(r["run_id"])      ?? "",
        severity:   asText(r["severity"])    ?? "INFO",
        title:      asText(r["title"])       ?? "",
        details:    asText(r["details"])     ?? "",
        ruleId:     r["rule_id"] != null ? (asText(r["rule_id"]) ?? null) : null,
        defectId:   r["defect_id"] != null ? (asText(r["defect_id"]) ?? null) : null,
        nodeIds:    (asJsonObject(r["node_ids"]) as unknown as string[]) ?? [],
        excerptIds: (asJsonObject(r["excerpt_ids"]) as unknown as string[]) ?? [],
        createdAt:  asText(r["created_at"])  ?? "",
      }));
      ok(id, rows);
      return;
    }

    // ---- GET_DEFECTS ----
    if (msg.type === "GET_DEFECTS") {
      const { caseId } = msg.payload;
      const defRes = await db.query(
        `SELECT defect_id, case_id, category, tier, stage, title, description,
                confidence, rule_id, created_at
         FROM defects WHERE case_id = $1
         ORDER BY created_at DESC`,
        [caseId]
      );
      const defects: DefectRow[] = [];
      for (const r of defRes.rows) {
        const defectId = asText(r["defect_id"]) ?? "";
        const remRes = await db.query(
          `SELECT r.remedy_id, r.jurisdiction, r.name, r.description, r.typical_deadline,
                  dr.priority, dr.rationale
           FROM defect_remedies dr
           JOIN remedies r ON r.remedy_id = dr.remedy_id
           WHERE dr.defect_id = $1
           ORDER BY dr.priority ASC`,
          [defectId]
        );
        const remedies: RemedyRow[] = remRes.rows.map(rr => ({
          remedyId:        asText(rr["remedy_id"])        ?? "",
          jurisdiction:    asText(rr["jurisdiction"])     ?? "NO",
          name:            asText(rr["name"])             ?? "",
          description:     asText(rr["description"])      ?? "",
          typicalDeadline: rr["typical_deadline"] != null ? (asText(rr["typical_deadline"]) ?? null) : null,
          priority:        asNumber(rr["priority"])       ?? 0,
          rationale:       rr["rationale"] != null ? (asText(rr["rationale"]) ?? null) : null,
        }));
        defects.push({
          defectId,
          caseId:      asText(r["case_id"])     ?? "",
          category:    asText(r["category"])    ?? "",
          tier:        asText(r["tier"])        ?? "T4",
          stage:       r["stage"] != null ? (asText(r["stage"]) ?? null) : null,
          title:       asText(r["title"])       ?? "",
          description: asText(r["description"]) ?? "",
          confidence:  asNumber(r["confidence"]) ?? 0,
          ruleId:      r["rule_id"] != null ? (asText(r["rule_id"]) ?? null) : null,
          createdAt:   asText(r["created_at"])  ?? "",
          remedies,
        });
      }
      ok(id, defects);
      return;
    }

    // ---- GET_AUDIT_TRAIL ----
    if (msg.type === "GET_AUDIT_TRAIL") {
      const { caseId, entityId, entityType } = msg.payload;
      let events;
      if (entityId) {
        events = await getAuditTrail(db, caseId, entityId, entityType);
      } else {
        // Return all events for the case
        const res = await db.query(
          `SELECT audit_id, case_id, event_time, actor, action, entity_type, entity_id, payload
           FROM audit_events
           WHERE case_id = $1
           ORDER BY event_time DESC`,
          [caseId]
        );
        events = res.rows.map(r => ({
          auditId:    asText(r["audit_id"])    ?? "",
          caseId:     asText(r["case_id"])     ?? "",
          eventTime:  asText(r["event_time"])  ?? "",
          actor:      asText(r["actor"])       ?? "",
          action:     asText(r["action"])      ?? "",
          entityType: r["entity_type"] != null ? (asText(r["entity_type"]) ?? null) : null,
          entityId:   r["entity_id"] != null ? (asText(r["entity_id"]) ?? null) : null,
          payload:    asJsonObject(r["payload"]),
        }));
      }
      ok(id, events);
      return;
    }

    // ---- GET_RUN_TRACE ----
    if (msg.type === "GET_RUN_TRACE") {
      const { caseId, runId } = msg.payload;
      const events = await getRunTrace(db, caseId, runId);
      ok(id, events);
      return;
    }

    // ---- BATCH_INGEST ----
    if (msg.type === "BATCH_INGEST") {
      const { caseId, document, excerpts, claims, decisions, entities, derivesFrom } = msg.payload;

      // Insert document
      await db.query(
        `INSERT INTO documents (doc_id, case_id, artifact_type, filename, stage, doc_date, source_label, is_primary_source)
         VALUES ($1, $2, $3::artifact_type, $4, $5::stage_code, $6::date, $7, $8)
         ON CONFLICT (doc_id) DO NOTHING`,
        [document.docId, caseId, document.artifactType, document.filename,
         document.stage ?? null, document.docDate ?? null,
         document.sourceLabel ?? null, document.isPrimarySource]
      );

      // Insert excerpts
      for (const ex of excerpts) {
        await db.query(
          `INSERT INTO excerpts (excerpt_id, doc_id, kind, page_no, text, normalized_text)
           VALUES ($1, $2, $3::excerpt_kind, $4, $5, $6)
           ON CONFLICT (excerpt_id) DO NOTHING`,
          [ex.excerptId, document.docId, ex.kind, ex.pageNo ?? null, ex.text, ex.text]
        );
      }

      // Insert claims
      for (const cl of claims) {
        await db.query(
          `INSERT INTO claims (claim_id, case_id, claim_type, stage, claim_text, eclass, ewi, independence_score, contradiction_score)
           VALUES ($1, $2, $3::claim_type, $4::stage_code, $5, $6::eclass, 0.5, 0.5, 0.0)
           ON CONFLICT (claim_id) DO NOTHING`,
          [cl.claimId, caseId, cl.claimType, cl.stage ?? null, cl.claimText, cl.eclass]
        );
      }

      // Insert decisions
      for (const dec of decisions) {
        await db.query(
          `INSERT INTO decisions (decision_id, case_id, stage, title, decided_date, authority, outcome)
           VALUES ($1, $2, $3::stage_code, $4, $5::date, $6, $7)
           ON CONFLICT (decision_id) DO NOTHING`,
          [dec.decisionId, caseId, dec.stage ?? null, dec.title,
           dec.decidedDate ?? null, dec.authority ?? null, dec.outcome ?? null]
        );
      }

      // Insert entities
      for (const en of entities) {
        await db.query(
          `INSERT INTO entities (entity_id, excerpt_id, type, value, confidence)
           VALUES ($1, $2, $3::entity_type, $4, 0.85)
           ON CONFLICT (entity_id) DO NOTHING`,
          [en.entityId, en.excerptId, en.type, en.value]
        );
      }

      // Populate graph from the newly inserted relational data
      const summary = await populateCaseGraph(db, caseId);

      ok(id, { inserted: { documents: 1, excerpts: excerpts.length, claims: claims.length, decisions: decisions.length, entities: entities.length }, graph: summary });
      return;
    }

    err((msg as { id?: string }).id, "Unknown message type");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const id = ("id" in msg) ? (msg as { id?: string }).id : undefined;
    err(id, message);
  }
};
