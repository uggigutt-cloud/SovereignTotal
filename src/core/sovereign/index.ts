// index.ts — public API surface of sovereign-modules

// Types
export type {
  StageCode, NodeType, EdgeType, DefectCategory, TierCode, Severity,
  GraphNode, GraphEdge, CaseGraphSnapshot,
  Finding, DefectDraft, RuleContext, RuleResult, Rule, RulePack
} from "./rules/sovereign-rulepack-api";

// DB
export type { PgLiteLike, SqlValue, SqlRow } from "./db/pglite-client";
export { asText, asNumber, asBool, asJsonObject } from "./db/pglite-client";
export type { ExecPgLike } from "./db/init-schema";
export { initSchema } from "./db/init-schema";
export { initSovereignDb } from "./db/sovereign-db-init";

// Graph
export { buildCaseGraphSnapshot } from "./graph/graph-builder";
export { populateCaseGraph } from "./graph/graph-populator";
export type { PopulatorSummary } from "./graph/graph-populator";
export { propagateInfections } from "./graph/infection-propagator";
export { buildGraphViewModel } from "./graph/graph-view-model";
export type { GraphViewModel, GraphNodeView, GraphEdgeView } from "./graph/graph-view-model";
export { buildIndexes, out, inn, node, stableId } from "./rules/graph-utils";

// Engine
export { normalizeGraphNodeAttributes } from "./engine/attribute-normalizer";
export type { NormalizerOptions, NormalizerSummary } from "./engine/attribute-normalizer";
export { runRulePackOnCase } from "./engine/rule-engine-runner";
export type { RunSummary, RunOptions } from "./engine/rule-engine-runner";
export { linkRemedies } from "./engine/remedy-linker";
export { computeClaimEwi, ECLASS_WEIGHT } from "./engine/ewi-scorer";
export { getAuditTrail, getRunTrace } from "./engine/trace-query";
export type { AuditEvent } from "./engine/trace-query";

// Rules
export { SovereignCoreRulePack } from "./rules/sovereign-core-rulepack";
export type { RemedyEntry } from "./rules/remedy-catalog";
export { NorwegianRemedyCatalog, SwedishRemedyCatalog, ALL_REMEDY_CATALOGS } from "./rules/remedy-catalog";
export { composePacks, filterPack } from "./rules/pack-composer";
export type { ComposeOptions, FilterOptions } from "./rules/pack-composer";
export {
  getJurisdictionRegistry,
  getRemediesForDefect,
  JURISDICTION_REGISTRIES
} from "./rules/jurisdiction-registry";
export type { JurisdictionRegistry } from "./rules/jurisdiction-registry";

// UI
export { runRulesViaWorker } from "./ui/runRules";
export type { RunRulesOptions } from "./ui/runRules";

// Worker protocol (message types for main-thread ↔ worker communication)
export type {
  WorkerInMsg, WorkerOutMsg,
  InitMsg, RunMsg,
  CreateCaseMsg, ListCasesMsg, GetCaseMsg,
  InsertGraphNodeMsg, InsertGraphEdgeMsg,
  GetGraphViewMsg, GetFindingsMsg, GetDefectsMsg,
  GetAuditTrailMsg, GetRunTraceMsg,
  BatchIngestMsg, BatchIngestPayload,
  InitOkMsg, NormalizeOkMsg, RunOkMsg, ErrorMsg, QueryOkMsg,
  CaseRow, FindingRow, DefectRow, RemedyRow,
} from "./workers/worker-protocol";

// Utils
export { fnv1a32, fnv1a32Hex, jsonStableStringify } from "./utils/hash-utils";
