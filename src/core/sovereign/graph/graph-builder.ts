// graph/graph-builder.ts

import type {
  CaseGraphSnapshot,
  GraphEdge,
  GraphNode,
  NodeType,
  EdgeType,
  StageCode
} from "../rules/sovereign-rulepack-api";
import { buildIndexes } from "../rules/graph-utils";
import type { PgLiteLike } from "../db/pglite-client";
import { asJsonObject, asNumber, asText } from "../db/pglite-client";

function assertNodeType(t: string): NodeType {
  const ok: NodeType[] = ["DOCUMENT","EXCERPT","CLAIM","DECISION","RULE","DEFECT","REMEDY","COUNTER"];
  if (ok.includes(t as NodeType)) return t as NodeType;
  throw new Error(`Invalid node_type: ${t}`);
}

function assertEdgeType(t: string): EdgeType {
  const ok: EdgeType[] = ["CONTAINS","ASSERTS","SUPPORTS","DERIVES_FROM","VIOLATES","INFECTS","COUNTERS","REFERENCES"];
  if (ok.includes(t as EdgeType)) return t as EdgeType;
  throw new Error(`Invalid edge_type: ${t}`);
}

function assertStage(s: unknown): StageCode | undefined {
  if (s === null || s === undefined) return undefined;
  const v = String(s);
  if (["A","B","C","D","E","F","G"].includes(v)) return v as StageCode;
  return undefined;
}

export interface BuildGraphOptions {
  includeEdgeAttrs?: boolean;
  includeNodeAttrs?: boolean;
  strict?: boolean;
}

export async function buildCaseGraphSnapshot(
  db: PgLiteLike,
  caseId: string,
  opts: BuildGraphOptions = {}
): Promise<CaseGraphSnapshot> {
  const includeNodeAttrs = opts.includeNodeAttrs ?? true;
  const includeEdgeAttrs = opts.includeEdgeAttrs ?? true;
  const strict = opts.strict ?? true;

  const nodesRes = await db.query(
    `
    SELECT node_id, type, ref_id, stage, label, attributes
    FROM graph_nodes
    WHERE case_id = $1
    ORDER BY node_id ASC
    `,
    [caseId]
  );

  const edgesRes = await db.query(
    `
    SELECT edge_id, type, from_node_id, to_node_id, weight, attributes
    FROM graph_edges
    WHERE case_id = $1
    ORDER BY edge_id ASC
    `,
    [caseId]
  );

  const nodes: GraphNode[] = nodesRes.rows.map((r) => {
    const id = asText(r["node_id"]);
    const type = asText(r["type"]);
    const refId = asText(r["ref_id"]);
    const label = asText(r["label"]);
    if (!id || !type || !refId || !label) throw new Error("Malformed graph_nodes row");

    return {
      id,
      type: assertNodeType(type),
      stage: assertStage(r["stage"]),
      label,
      refId,
      attrs: includeNodeAttrs ? asJsonObject(r["attributes"]) : {}
    };
  });

  const nodeIdSet = new Set(nodes.map(n => n.id));

  const edges: GraphEdge[] = [];
  for (const r of edgesRes.rows) {
    const id = asText(r["edge_id"]);
    const type = asText(r["type"]);
    const from = asText(r["from_node_id"]);
    const to = asText(r["to_node_id"]);
    if (!id || !type || !from || !to) throw new Error("Malformed graph_edges row");

    if (!nodeIdSet.has(from) || !nodeIdSet.has(to)) {
      const msg = `Dangling edge ${id}: ${from} -> ${to}`;
      if (strict) throw new Error(msg);
      continue;
    }

    edges.push({
      id,
      type: assertEdgeType(type),
      from,
      to,
      weight: asNumber(r["weight"]) ?? 1.0,
      attrs: includeEdgeAttrs ? asJsonObject(r["attributes"]) : {}
    });
  }

  return buildIndexes({ caseId, nodes, edges });
}
