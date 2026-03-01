// engine/trace-query.ts
// Query utilities for retrieving per-entity and per-run audit lineage.
// Requires schema v4 (entity_type + entity_id columns on audit_events).

import type { PgLiteLike } from "../db/pglite-client";
import { asText, asJsonObject } from "../db/pglite-client";

export interface AuditEvent {
  auditId: string;
  caseId: string;
  eventTime: string;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
}

function rowToEvent(r: Record<string, unknown>): AuditEvent {
  return {
    auditId:    asText(r["audit_id"])    ?? "",
    caseId:     asText(r["case_id"])     ?? "",
    eventTime:  asText(r["event_time"])  ?? "",
    actor:      asText(r["actor"])       ?? "",
    action:     asText(r["action"])      ?? "",
    entityType: r["entity_type"] != null ? (asText(r["entity_type"]) ?? null) : null,
    entityId:   r["entity_id"]   != null ? (asText(r["entity_id"])   ?? null) : null,
    payload:    asJsonObject(r["payload"])
  };
}

/**
 * Return all audit events for a specific entity (e.g. a finding or defect),
 * ordered chronologically (event_time ASC).
 *
 * @param entityType  Optional — narrows results to a specific entity type
 *                    (e.g. "finding", "defect"). Pass undefined to match any type.
 */
export async function getAuditTrail(
  db: PgLiteLike,
  caseId: string,
  entityId: string,
  entityType?: string
): Promise<AuditEvent[]> {
  const res = await db.query(
    `
    SELECT audit_id, case_id, event_time, actor, action, entity_type, entity_id, payload
    FROM audit_events
    WHERE case_id = $1
      AND entity_id = $2
      AND ($3::text IS NULL OR entity_type = $3)
    ORDER BY event_time ASC
    `,
    [caseId, entityId, entityType ?? null]
  );
  return res.rows.map(rowToEvent);
}

/**
 * Return all audit events for a specific rule run, identified by runId
 * stored inside the payload JSON. Ordered chronologically (event_time ASC).
 *
 * Covers: RULE_RUN_START, RULE_EVALUATED, RULE_EVALUATE_ERROR, RULE_RUN_FINISH,
 *         DEFECT_CREATED, FINDING_CREATED.
 */
export async function getRunTrace(
  db: PgLiteLike,
  caseId: string,
  runId: string
): Promise<AuditEvent[]> {
  const res = await db.query(
    `
    SELECT audit_id, case_id, event_time, actor, action, entity_type, entity_id, payload
    FROM audit_events
    WHERE case_id = $1
      AND (payload->>'runId') = $2
    ORDER BY event_time ASC
    `,
    [caseId, runId]
  );
  return res.rows.map(rowToEvent);
}
