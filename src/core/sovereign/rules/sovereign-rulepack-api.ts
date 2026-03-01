// rules/sovereign-rulepack-api.ts

export type StageCode = "A"|"B"|"C"|"D"|"E"|"F"|"G";
export type NodeType =
  | "DOCUMENT" | "EXCERPT" | "CLAIM" | "DECISION" | "RULE" | "DEFECT" | "REMEDY" | "COUNTER";

export type EdgeType =
  | "CONTAINS" | "ASSERTS" | "SUPPORTS" | "DERIVES_FROM" | "VIOLATES" | "INFECTS" | "COUNTERS" | "REFERENCES";

export type DefectCategory =
  | "HOMELESMANGEL"
  | "KOMPETANSEMANGEL"
  | "UTREDNINGSPLIKTBRUDD"
  | "KONTRADIKSJONSPARTSRETT"
  | "BEGRUNNELSESMANGEL"
  | "FEIL_FAKTUM_INNHOLD"
  | "DATAINTEGRITET_TAUSHET"
  | "EMK_PROSESS";

export type TierCode = "T1"|"T2"|"T3"|"T4";
export type Severity = "INFO"|"LOW"|"MED"|"HIGH"|"CRITICAL";

export interface GraphNode {
  id: string;
  type: NodeType;
  stage?: StageCode;
  label: string;
  refId: string;
  attrs: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  weight: number;
  attrs: Record<string, unknown>;
}

export interface CaseGraphSnapshot {
  caseId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  indexes?: {
    byId?: Map<string, GraphNode>;
    outEdges?: Map<string, GraphEdge[]>;
    inEdges?: Map<string, GraphEdge[]>;
  };
  /**
   * Pre-computed multi-hop infection set (populated by the rule engine runner
   * via graph/infection-propagator before rules are evaluated).
   * Rules should use this when available instead of doing their own one-hop check.
   */
  infectedSet?: Set<string>;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  details: string;
  ruleId?: string;
  /** Links this finding to a DefectDraft produced in the same rule evaluation. */
  defectId?: string;
  nodeIds: string[];
  excerptIds: string[];
  evidence: {
    triggeredBy: string[];
    thresholds: Record<string, number>;
    computed: Record<string, number | string | boolean>;
  };
}

export interface DefectDraft {
  defectId: string;
  category: DefectCategory;
  tier: TierCode;
  stage?: StageCode;
  title: string;
  description: string;
  confidence: number;
  ruleId?: string;
  primaryExcerptId?: string;
  meta: Record<string, unknown>;
  infectNodeIds: string[];
}

export interface RuleContext {
  nowISO: string;
  rulepackId: string;
  version: string;
  /** ISO 3166-1 alpha-2 jurisdiction code. Default: "NO". */
  jurisdiction?: string;
  thresholds: {
    independenceMin: number;
    ewiMin: number;
    contradictionMax: number;
  };
  /**
   * Per-stage authority allow-lists for R-KOMPETANSE-UNAUTHORIZED-STAGE.
   * If absent the rule is a no-op (gracefully skipped).
   * Example: { A: ["Nav lokalt", "Barneverntjenesten"], D: ["Fylkesnemnda"] }
   */
  authorityConstraints?: Partial<Record<StageCode, string[]>>;
}

export interface RuleResult {
  findings: Finding[];
  defectDrafts: DefectDraft[];
}

export interface Rule {
  id: string;
  description: string;
  /** Legal citation (e.g. "forvaltningsloven § 17"). Stored in the rules table. */
  citation?: string;
  /** Rule kind classification (e.g. "PROCEDURAL", "EVIDENCE"). Stored in the rules table. */
  kind?: string;
  /** ISO 3166-1 alpha-2 jurisdiction code. Default: "NO". */
  jurisdiction?: string;
  evaluate: (g: CaseGraphSnapshot, ctx: RuleContext) => RuleResult;
}

export interface RulePack {
  id: string;
  version: string;
  rules: Rule[];
}
