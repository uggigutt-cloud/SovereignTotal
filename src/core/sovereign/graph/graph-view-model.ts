// graph/graph-view-model.ts
// Serializes a CaseGraphSnapshot into a flat, JSON-serializable view-model
// suitable for UI rendering or external consumers.
//
// This is a pure function — no DB access required.
// Call it after buildCaseGraphSnapshot (and optionally after propagateInfections
// so that infectedSet is populated on the snapshot).

import type {
  CaseGraphSnapshot,
  NodeType,
  EdgeType,
  StageCode
} from "../rules/sovereign-rulepack-api";
import { inn, node } from "../rules/graph-utils";

export interface GraphNodeView {
  id: string;
  type: NodeType;
  stage?: StageCode;
  label: string;
  refId: string;
  attrs: Record<string, unknown>;
  /** True when the node appears in `g.infectedSet` (multi-hop contamination). */
  isInfected: boolean;
  /**
   * refIds of DEFECT nodes that INFECT this node via an incoming INFECTS edge.
   * Useful for linking a node to the defects that flagged it.
   */
  defectIds: string[];
}

export interface GraphEdgeView {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  weight: number;
}

export interface GraphViewModel {
  caseId: string;
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  stats: {
    nodesByType: Partial<Record<NodeType, number>>;
    edgesByType: Partial<Record<EdgeType, number>>;
    infectedCount: number;
    defectCount: number;
  };
}

/**
 * Build a JSON-serializable view-model from a case graph snapshot.
 *
 * The snapshot should already be indexed (buildIndexes) for inn() to work.
 * If `g.infectedSet` is present (set by propagateInfections), `isInfected`
 * will be populated correctly; otherwise it defaults to false.
 */
export function buildGraphViewModel(g: CaseGraphSnapshot): GraphViewModel {
  const nodesByType: Partial<Record<NodeType, number>> = {};
  const edgesByType: Partial<Record<EdgeType, number>> = {};
  let infectedCount = 0;
  let defectCount = 0;

  const nodes: GraphNodeView[] = g.nodes.map(n => {
    // Accumulate stats
    nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
    if (n.type === "DEFECT") defectCount++;

    const isInfected = g.infectedSet ? g.infectedSet.has(n.id) : false;
    if (isInfected) infectedCount++;

    // Collect DEFECT refIds that infect this node via INFECTS edges
    const defectIds: string[] = [];
    if (g.indexes) {
      for (const e of inn(g, n.id, "INFECTS")) {
        const src = node(g, e.from);
        if (src?.type === "DEFECT") defectIds.push(src.refId);
      }
    }

    return {
      id: n.id,
      type: n.type,
      stage: n.stage,
      label: n.label,
      refId: n.refId,
      attrs: n.attrs,
      isInfected,
      defectIds
    };
  });

  const edges: GraphEdgeView[] = g.edges.map(e => {
    edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
    return {
      id: e.id,
      type: e.type,
      from: e.from,
      to: e.to,
      weight: e.weight
    };
  });

  return {
    caseId: g.caseId,
    nodes,
    edges,
    stats: { nodesByType, edgesByType, infectedCount, defectCount }
  };
}
