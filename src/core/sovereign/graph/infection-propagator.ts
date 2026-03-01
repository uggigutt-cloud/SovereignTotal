// graph/infection-propagator.ts
// Multi-hop infection propagation over DERIVES_FROM edges.
//
// Problem: R_CHAIN_CONTAMINATION only checks one hop — if B DERIVES_FROM infected A,
// B is flagged, but C DERIVES_FROM B is not, even though C is transitively tainted.
//
// Solution: BFS from seed set, expanding through DERIVES_FROM edges up to maxDepth times.
// The runner calls this once after building the graph snapshot and stores the result
// in g.infectedSet so all rules can use the pre-computed multi-hop set.

import type { CaseGraphSnapshot } from "../rules/sovereign-rulepack-api";
import { buildIndexes, inn } from "../rules/graph-utils";

/**
 * Returns the full set of infected node IDs, including all transitive descendants
 * of the initial seed nodes via DERIVES_FROM edges.
 *
 * Edge direction: { type: "DERIVES_FROM", from: B, to: A } means B derives from A.
 * So if A is infected and B → A (DERIVES_FROM), then B is contaminated.
 * inn(g, A, "DERIVES_FROM") returns such edges; their `.from` gives the contaminated child.
 *
 * The snapshot must have been indexed (buildIndexes) for inn() to work efficiently.
 * The runner ensures this before calling.
 *
 * @param g         A case graph snapshot (indexed).
 * @param maxDepth  Maximum propagation depth. Default: 8.
 */
export function propagateInfections(
  g: CaseGraphSnapshot,
  maxDepth = 8
): Set<string> {
  // Build indexes if not already present (defensive — runner always calls buildIndexes first).
  const indexed = g.indexes ? g : buildIndexes(g);

  // Seed: nodes already marked infected via attribute or incoming INFECTS edges.
  const infected = new Set<string>();
  for (const n of indexed.nodes) {
    if (n.attrs?.["infected"] === true) infected.add(n.id);
  }
  for (const e of indexed.edges) {
    if (e.type === "INFECTS") infected.add(e.to);
  }

  // BFS: for each infected node A, any node B where B→A (DERIVES_FROM) is contaminated.
  let frontier = new Set(infected);

  for (let depth = 0; depth < maxDepth && frontier.size > 0; depth++) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      // inn(g, nodeId, "DERIVES_FROM") → edges where `to === nodeId` and type === DERIVES_FROM
      // → their `from` is a node that derives from nodeId (and is now contaminated)
      for (const edge of inn(indexed, nodeId, "DERIVES_FROM")) {
        if (!infected.has(edge.from)) {
          infected.add(edge.from);
          next.add(edge.from);
        }
      }
    }
    frontier = next;
  }

  return infected;
}
