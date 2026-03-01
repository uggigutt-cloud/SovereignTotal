// testing/fixtures.ts
// Graph fixture builders for unit and integration tests.
// Each builder inserts minimal, self-consistent test data and returns
// the IDs needed to assert against rule outputs.

import type { PgLiteLike } from "../db/pglite-client";
import { buildIndexes } from "../rules/graph-utils";
import type { CaseGraphSnapshot, GraphEdge, GraphNode } from "../rules/sovereign-rulepack-api";

// ---------------------------------------------------------------------------
// In-memory graph builder (no DB needed — for pure rule unit tests)
// ---------------------------------------------------------------------------

/** Build a CaseGraphSnapshot from raw node/edge descriptors. */
export function makeGraph(
  caseId: string,
  nodes: Partial<GraphNode>[],
  edges: Partial<GraphEdge>[]
): CaseGraphSnapshot {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node-${i}`,
    type: n.type ?? "CLAIM",
    stage: n.stage,
    label: n.label ?? n.id ?? `node-${i}`,
    refId: n.refId ?? n.id ?? `node-${i}`,
    attrs: n.attrs ?? {}
  }));

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge-${i}`,
    type: e.type ?? "DERIVES_FROM",
    from: e.from ?? "",
    to: e.to ?? "",
    weight: e.weight ?? 1.0,
    attrs: e.attrs ?? {}
  }));

  return buildIndexes({ caseId, nodes: fullNodes, edges: fullEdges });
}

// ---------------------------------------------------------------------------
// DB fixtures — insert test data directly into the graph_nodes / graph_edges tables
// ---------------------------------------------------------------------------

/** Inserts a case row and returns the caseId. */
export async function insertCase(db: PgLiteLike, caseId: string): Promise<void> {
  await db.query(
    `INSERT INTO cases (case_id, title) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [caseId, `Test Case ${caseId}`]
  );
}

type NodeAttrs = Record<string, unknown>;

export async function insertNode(
  db: PgLiteLike,
  caseId: string,
  nodeId: string,
  type: string,
  refId: string,
  label: string,
  stage: string | null,
  attrs: NodeAttrs
): Promise<void> {
  await db.query(
    `
    INSERT INTO graph_nodes (node_id, case_id, type, ref_id, stage, label, attributes)
    VALUES ($1, $2, $3::node_type, $4, $5::stage_code, $6, $7::jsonb)
    ON CONFLICT (node_id) DO NOTHING
    `,
    [nodeId, caseId, type, refId, stage, label, JSON.stringify(attrs)]
  );
}

export async function insertEdge(
  db: PgLiteLike,
  caseId: string,
  edgeId: string,
  type: string,
  fromId: string,
  toId: string
): Promise<void> {
  await db.query(
    `
    INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight, attributes)
    VALUES ($1, $2, $3::edge_type, $4, $5, 1.0, '{}'::jsonb)
    ON CONFLICT (edge_id) DO NOTHING
    `,
    [edgeId, caseId, type, fromId, toId]
  );
}

export async function insertCounter(
  db: PgLiteLike,
  caseId: string,
  counterId: string,
  decisionId: string,
  title: string,
  text: string,
  counterType = "OBJECTION"
): Promise<void> {
  await db.query(
    `
    INSERT INTO counters (counter_id, case_id, decision_id, counter_type, title, text)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (counter_id) DO NOTHING
    `,
    [counterId, caseId, decisionId, counterType, title, text]
  );
}

// ---------------------------------------------------------------------------
// Post-closure fixture
// ---------------------------------------------------------------------------

export interface PostClosureFixtureIds {
  caseId: string;
  closureNodeId: string;
  actionNodeId: string;
}

/**
 * Inserts a HENLEGGELSE DECISION node (closed 2023-01-01) and a CLAIM node
 * with action_flag=true that occurs after closure (2023-06-01).
 * No NY_SAK node — so the rule SHOULD fire.
 */
export async function buildPostClosureFixture(
  db: PgLiteLike,
  caseId = "case-postclosure"
): Promise<PostClosureFixtureIds> {
  await insertCase(db, caseId);

  const closureNodeId = `${caseId}-closure`;
  const actionNodeId = `${caseId}-action`;

  await insertNode(db, caseId, closureNodeId, "DECISION", closureNodeId, "Henleggelse", "A", {
    decision_type: "HENLEGGELSE",
    decided_date: "2023-01-01"
  });

  await insertNode(db, caseId, actionNodeId, "CLAIM", actionNodeId, "Handling etter lukking", "A", {
    action_flag: true,
    event_date: "2023-06-01"
  });

  return { caseId, closureNodeId, actionNodeId };
}

// ---------------------------------------------------------------------------
// DAG cycle fixture
// ---------------------------------------------------------------------------

export interface CycleFixtureIds {
  caseId: string;
  nodeA: string;
  nodeB: string;
  nodeC: string;
}

/**
 * Inserts three CLAIM nodes (A→B→C→A via DERIVES_FROM) forming a cycle.
 */
export async function buildCycleFixture(
  db: PgLiteLike,
  caseId = "case-cycle"
): Promise<CycleFixtureIds> {
  await insertCase(db, caseId);

  const nodeA = `${caseId}-A`;
  const nodeB = `${caseId}-B`;
  const nodeC = `${caseId}-C`;

  for (const [id, label] of [[nodeA, "A"], [nodeB, "B"], [nodeC, "C"]] as const) {
    await insertNode(db, caseId, id, "CLAIM", id, label, null, {});
  }

  await insertEdge(db, caseId, `edge-AB`, "DERIVES_FROM", nodeA, nodeB);
  await insertEdge(db, caseId, `edge-BC`, "DERIVES_FROM", nodeB, nodeC);
  await insertEdge(db, caseId, `edge-CA`, "DERIVES_FROM", nodeC, nodeA);

  return { caseId, nodeA, nodeB, nodeC };
}

// ---------------------------------------------------------------------------
// Chain contamination fixture
// ---------------------------------------------------------------------------

export interface ContaminationFixtureIds {
  caseId: string;
  infectedNodeId: string;
  derivedNodeId: string;
}

/**
 * Inserts an INFECTED DECISION node and a CLAIM that DERIVES_FROM it
 * with low independence_score (0.3) and low ewi (0.4).
 * Should trigger R_CHAIN_CONTAMINATION.
 */
export async function buildContaminationFixture(
  db: PgLiteLike,
  caseId = "case-contamination"
): Promise<ContaminationFixtureIds> {
  await insertCase(db, caseId);

  const infectedNodeId = `${caseId}-infected`;
  const derivedNodeId = `${caseId}-derived`;

  await insertNode(db, caseId, infectedNodeId, "DECISION", infectedNodeId, "Infected Decision", null, {
    infected: true,
    independence_score: 0.5,
    ewi: 0.5
  });

  await insertNode(db, caseId, derivedNodeId, "CLAIM", derivedNodeId, "Derived Claim", null, {
    independence_score: 0.3,
    ewi: 0.4
  });

  await insertEdge(db, caseId, `edge-derived`, "DERIVES_FROM", derivedNodeId, infectedNodeId);

  return { caseId, infectedNodeId, derivedNodeId };
}
