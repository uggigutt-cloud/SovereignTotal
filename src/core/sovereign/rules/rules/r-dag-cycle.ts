// rules/rules/r-dag-cycle.ts

import { type CaseGraphSnapshot, type Finding, type Rule, type RuleContext } from "../sovereign-rulepack-api";
import { buildIndexes, stableId } from "../graph-utils";

export const R_DAG_CYCLE: Rule = {
  id: "R-GRAPH-DAG-CYCLE",
  description: "Detects cycles in DERIVES_FROM edges (circular reasoning / sirkelbevis).",
  citation: "Alminnelig bevisrettslig prinsipp — forbud mot sirkelbevis",
  kind: "EVIDENCE",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);

    // Build adjacency list from DERIVES_FROM edges only
    const adj = new Map<string, string[]>();
    for (const n of g.nodes) adj.set(n.id, []);
    for (const e of g.edges) {
      if (e.type !== "DERIVES_FROM") continue;
      adj.get(e.from)?.push(e.to);
    }
    for (const [, arr] of adj) arr.sort();

    const visited = new Set<string>();
    const onStack = new Set<string>();
    const findings: Finding[] = [];
    const reportedCycles = new Set<string>();

    // Iterative DFS — avoids JS call-stack overflow on deep graphs.
    // Each stack frame tracks: { node, path, nextChildIndex }
    type Frame = { node: string; path: string[]; nextIdx: number };

    const startNodes = [...g.nodes.map(n => n.id)].sort();

    for (const start of startNodes) {
      if (visited.has(start)) continue;

      const stack: Frame[] = [{ node: start, path: [start], nextIdx: 0 }];

      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;
        const { node: u, path } = frame;

        if (frame.nextIdx === 0) {
          // First time visiting this node in this DFS path
          visited.add(u);
          onStack.add(u);
        }

        const nexts = adj.get(u) ?? [];

        if (frame.nextIdx < nexts.length) {
          const v = nexts[frame.nextIdx]!;
          frame.nextIdx++;

          if (!visited.has(v)) {
            stack.push({ node: v, path: [...path, v], nextIdx: 0 });
          } else if (onStack.has(v)) {
            // Back edge found — extract the cycle
            const idx = path.indexOf(v);
            const cycle = idx >= 0 ? path.slice(idx) : [v];

            // Deduplicate by canonical cycle key (sorted start node)
            const cycleKey = [...cycle].sort().join(">");
            if (!reportedCycles.has(cycleKey)) {
              reportedCycles.add(cycleKey);
              const id = stableId("finding", [ctx.rulepackId, ctx.version, "cycle", cycle.join(">")]);

              findings.push({
                id,
                severity: "CRITICAL",
                title: "Sirkelbevis: sykel i DERIVES_FROM-kjeden",
                details: `DERIVES_FROM danner en sykel (sirkelresonnement): ${cycle.join(" -> ")} -> ${cycle[0]}.`,
                ruleId: "R-GRAPH-DAG-CYCLE",
                nodeIds: cycle,
                excerptIds: [],
                evidence: {
                  triggeredBy: ["DAG_CYCLE_DETECTED"],
                  thresholds: {},
                  computed: { cycleLength: cycle.length }
                }
              });
            }
          }
        } else {
          // All children of this node processed — pop frame
          onStack.delete(u);
          stack.pop();
        }
      }
    }

    return { findings, defectDrafts: [] };
  }
};
