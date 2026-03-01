// rules/graph-utils.ts

import { CaseGraphSnapshot, GraphEdge, GraphNode } from "./sovereign-rulepack-api";
import { fnv1a32 } from "../utils/hash-utils";

export function buildIndexes(g: CaseGraphSnapshot): CaseGraphSnapshot {
  const byId = new Map<string, GraphNode>();
  const outEdges = new Map<string, GraphEdge[]>();
  const inEdges = new Map<string, GraphEdge[]>();

  for (const n of g.nodes) byId.set(n.id, n);
  for (const e of g.edges) {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    if (!inEdges.has(e.to)) inEdges.set(e.to, []);
    outEdges.get(e.from)!.push(e);
    inEdges.get(e.to)!.push(e);
  }

  for (const [k, arr] of outEdges) arr.sort((a,b) => a.id.localeCompare(b.id));
  for (const [k, arr] of inEdges) arr.sort((a,b) => a.id.localeCompare(b.id));

  return { ...g, indexes: { byId, outEdges, inEdges } };
}

export function out(g: CaseGraphSnapshot, nodeId: string, type?: string): GraphEdge[] {
  const arr = g.indexes?.outEdges?.get(nodeId) ?? [];
  return type ? arr.filter(e => e.type === type) : arr;
}

export function inn(g: CaseGraphSnapshot, nodeId: string, type?: string): GraphEdge[] {
  const arr = g.indexes?.inEdges?.get(nodeId) ?? [];
  return type ? arr.filter(e => e.type === type) : arr;
}

export function node(g: CaseGraphSnapshot, nodeId: string): GraphNode | undefined {
  return g.indexes?.byId?.get(nodeId);
}

export function stableId(prefix: string, parts: string[]): string {
  return `${prefix}_${fnv1a32(parts.join("|")).toString(16)}`;
}
