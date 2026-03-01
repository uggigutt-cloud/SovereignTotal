// workers/worker-protocol.ts
// Discriminated-union message types shared by rule-worker.ts (sender side)
// and ui/runRules.ts (receiver side). Keeping them here prevents the two
// ends from drifting apart.

import type { NormalizerSummary } from "../engine/attribute-normalizer";
import type { RunSummary } from "../engine/rule-engine-runner";
import type { GraphViewModel } from "../graph/graph-view-model";

// ---------- Messages sent TO the worker ----------

/** Initialise the worker's internal PGLite instance. */
export interface InitMsg {
  type: "INIT_DB";
  payload: {
    /** Full SQL string of the schema to apply. Pass sovereign-schema-v1.sql contents. */
    schemaSQL: string;
    /** Optional IDB path for persistent storage. Omit for in-memory. */
    dbPath?: string;
    /** Additional schema SQL strings to apply in order (v2, v3, v4…). */
    extraSchemas?: string[];
  };
}

/** Run the full normalise → rule-engine pipeline for a case. */
export interface RunMsg {
  type: "RUN_RULEPACK";
  payload: {
    caseId: string;
    thresholds?: {
      independenceMin?: number;
      ewiMin?: number;
      contradictionMax?: number;
    };
  };
}

// ---------- CRUD messages (all include `id` for request-response correlation) ----------

export interface CreateCaseMsg {
  type: "CREATE_CASE";
  id: string;
  payload: { caseId: string; title: string; jurisdiction?: string; notes?: string };
}

export interface ListCasesMsg {
  type: "LIST_CASES";
  id: string;
}

export interface GetCaseMsg {
  type: "GET_CASE";
  id: string;
  payload: { caseId: string };
}

export interface InsertGraphNodeMsg {
  type: "INSERT_GRAPH_NODE";
  id: string;
  payload: {
    caseId: string;
    nodeId: string;
    nodeType: string;
    refId: string;
    label: string;
    stage?: string;
    attrs?: Record<string, unknown>;
  };
}

export interface InsertGraphEdgeMsg {
  type: "INSERT_GRAPH_EDGE";
  id: string;
  payload: {
    caseId: string;
    edgeId: string;
    edgeType: string;
    fromNodeId: string;
    toNodeId: string;
    weight?: number;
  };
}

export interface GetGraphViewMsg {
  type: "GET_GRAPH_VIEW";
  id: string;
  payload: { caseId: string };
}

export interface GetFindingsMsg {
  type: "GET_FINDINGS";
  id: string;
  payload: { caseId: string };
}

export interface GetDefectsMsg {
  type: "GET_DEFECTS";
  id: string;
  payload: { caseId: string };
}

export interface GetAuditTrailMsg {
  type: "GET_AUDIT_TRAIL";
  id: string;
  payload: { caseId: string; entityId?: string; entityType?: string };
}

export interface GetRunTraceMsg {
  type: "GET_RUN_TRACE";
  id: string;
  payload: { caseId: string; runId: string };
}

/** Structured data extracted from a document (e.g. by Gemini). The worker
 *  inserts into relational tables then calls populateCaseGraph(). */
export interface BatchIngestPayload {
  caseId: string;
  document: {
    docId: string;
    filename: string;
    artifactType: string;
    stage: string | null;
    docDate: string | null;
    sourceLabel: string | null;
    isPrimarySource: boolean;
  };
  excerpts: Array<{
    excerptId: string;
    text: string;
    pageNo: number | null;
    kind: string;
  }>;
  claims: Array<{
    claimId: string;
    claimText: string;
    claimType: string;
    eclass: string;
    stage: string | null;
    excerptId: string | null;
  }>;
  decisions: Array<{
    decisionId: string;
    title: string;
    decidedDate: string | null;
    authority: string | null;
    stage: string | null;
    outcome: string | null;
  }>;
  entities: Array<{
    entityId: string;
    excerptId: string;
    type: string;
    value: string;
  }>;
  derivesFrom: Array<{
    fromClaimId: string;
    toClaimId: string;
  }>;
}

export interface BatchIngestMsg {
  type: "BATCH_INGEST";
  id: string;
  payload: BatchIngestPayload;
}

export type WorkerInMsg =
  | InitMsg
  | RunMsg
  | CreateCaseMsg
  | ListCasesMsg
  | GetCaseMsg
  | InsertGraphNodeMsg
  | InsertGraphEdgeMsg
  | GetGraphViewMsg
  | GetFindingsMsg
  | GetDefectsMsg
  | GetAuditTrailMsg
  | GetRunTraceMsg
  | BatchIngestMsg;

// ---------- Messages sent FROM the worker ----------

export interface InitOkMsg { type: "INIT_OK" }

export interface NormalizeOkMsg {
  type: "NORMALIZE_OK";
  payload: NormalizerSummary;
}

export interface RunOkMsg {
  type: "RUN_OK";
  payload: RunSummary;
}

export interface ErrorMsg {
  type: "ERROR";
  id?: string;
  payload: { message: string };
}

/** Generic success response for all CRUD operations. `id` matches the request. */
export interface QueryOkMsg {
  type: "QUERY_OK";
  id: string;
  payload: unknown;
}

export type WorkerOutMsg = InitOkMsg | NormalizeOkMsg | RunOkMsg | ErrorMsg | QueryOkMsg;

// ---------- Convenience row types returned by CRUD queries ----------

export interface CaseRow {
  caseId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  locale: string;
  notes: string | null;
}

export interface FindingRow {
  findingId: string;
  runId: string;
  severity: string;
  title: string;
  details: string;
  ruleId: string | null;
  defectId: string | null;
  nodeIds: string[];
  excerptIds: string[];
  createdAt: string;
}

export interface DefectRow {
  defectId: string;
  caseId: string;
  category: string;
  tier: string;
  stage: string | null;
  title: string;
  description: string;
  confidence: number;
  ruleId: string | null;
  createdAt: string;
  remedies: RemedyRow[];
}

export interface RemedyRow {
  remedyId: string;
  jurisdiction: string;
  name: string;
  description: string;
  typicalDeadline: string | null;
  priority: number;
  rationale: string | null;
}

export type { GraphViewModel };
