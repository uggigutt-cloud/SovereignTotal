// rules/rules/r-stage-regression.ts

import type { DefectDraft, Finding, Rule, StageCode } from "../sovereign-rulepack-api";
import { buildIndexes, stableId } from "../graph-utils";

const STAGE_ORDER: Record<StageCode, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6
};

function parseDateISO(d: unknown): number | null {
  if (typeof d !== "string") return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

export const R_STAGE_REGRESSION: Rule = {
  id: "R-STAGE-REGRESSION",
  description: "Detects DECISION pairs where a later-dated node has an earlier stage code (regression).",
  citation: "Alminnelig saksbehandlingskrav — framdriftsretning i saksforløpet",
  kind: "PROCEDURAL",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];
    const reported = new Set<string>();

    const dated = g.nodes
      .filter(n => n.type === "DECISION" && n.stage != null)
      .map(n => ({ n, t: parseDateISO(n.attrs?.["decided_date"]) }))
      .filter((x): x is { n: typeof x.n; t: number } => x.t !== null)
      .sort((a, b) => a.t - b.t);

    // O(n²) sliding-window — acceptable for typical case sizes (< 100 decisions).
    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        const earlier = dated[i]!;
        const later = dated[j]!;

        if (STAGE_ORDER[later.n.stage!] < STAGE_ORDER[earlier.n.stage!]) {
          const pairKey = `${earlier.n.id}|${later.n.id}`;
          if (reported.has(pairKey)) continue;
          reported.add(pairKey);

          const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "STAGEREG", earlier.n.id, later.n.id]);
          const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "STAGEREG", earlier.n.id, later.n.id]);

          findings.push({
            id: findingId,
            severity: "MED",
            title: "Stadietilbakegang: vedtak i lavere fase etter høyere fase",
            details:
              `Vedtak ${later.n.id} (stage=${later.n.stage}, dato=${String(later.n.attrs?.["decided_date"])}) ` +
              `ble avsagt etter ${earlier.n.id} (stage=${earlier.n.stage}, dato=${String(earlier.n.attrs?.["decided_date"])}) ` +
              `men er i lavere behandlingsstadium.`,
            ruleId: "R-STAGE-REGRESSION",
            defectId,
            nodeIds: [earlier.n.id, later.n.id],
            excerptIds: [],
            evidence: {
              triggeredBy: ["STAGE_REGRESSION"],
              thresholds: {},
              computed: {
                earlierStage: earlier.n.stage ?? "",
                laterStage: later.n.stage ?? "",
                earlierDate: String(earlier.n.attrs?.["decided_date"]),
                laterDate: String(later.n.attrs?.["decided_date"])
              }
            }
          });

          defectDrafts.push({
            defectId,
            category: "HOMELESMANGEL",
            tier: "T2",
            stage: later.n.stage,
            title: "Stadietilbakegang i saksforløpet",
            description:
              "Et vedtak i lavere fase ble avsagt etter et vedtak i høyere fase. " +
              "Kan indikere manglende hjemmel eller saksbehandlingsfeil.",
            confidence: 0.95,
            ruleId: "R-STAGE-REGRESSION",
            meta: {
              earlierNodeId: earlier.n.id,
              laterNodeId: later.n.id,
              earlierStage: earlier.n.stage,
              laterStage: later.n.stage
            },
            infectNodeIds: [later.n.id]
          });
        }
      }
    }

    return { findings, defectDrafts };
  }
};
