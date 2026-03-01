// rules/rules/r-kontradiksjon.ts

import type { DefectDraft, Finding, Rule, StageCode } from "../sovereign-rulepack-api";
import { buildIndexes, out, stableId } from "../graph-utils";

const LATE_STAGES = new Set<StageCode>(["D", "E", "F", "G"]);

const CONFIDENCE_BY_STAGE: Partial<Record<StageCode, number>> = {
  D: 0.70, E: 0.80, F: 0.90, G: 0.90
};

export const R_KONTRADIKSJON: Rule = {
  id: "R-KONTRADIKSJON-COUNTER-ABSENT",
  description: "Detects DECISION nodes at late stages (D–G) with no COUNTER nodes connected via COUNTERS edges.",
  citation: "Forvaltningsloven § 16 og § 17 — kontradiksjon og partsinnsyn",
  kind: "PROCEDURAL",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    const candidates = g.nodes
      .filter(n => n.type === "DECISION" && n.stage != null && LATE_STAGES.has(n.stage))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const n of candidates) {
      const counters = out(g, n.id, "COUNTERS");
      if (counters.length > 0) continue;

      const stage = n.stage as StageCode;
      const confidence = CONFIDENCE_BY_STAGE[stage] ?? 0.70;
      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "KONTRADIKSJON", n.id]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "KONTRADIKSJON", n.id]);

      findings.push({
        id: findingId,
        severity: "HIGH",
        title: "Kontradiksjonssvikt: vedtak uten motargumentknute",
        details:
          `DECISION ${n.id} (stage=${stage}) har ingen utgående COUNTERS-kanter. ` +
          `Mangler dokumentert kontradiktorisk behandling.`,
        ruleId: "R-KONTRADIKSJON-COUNTER-ABSENT",
        defectId,
        nodeIds: [n.id],
        excerptIds: [],
        evidence: {
          triggeredBy: ["DECISION_NO_COUNTERS"],
          thresholds: {},
          computed: { stage, confidence }
        }
      });

      defectDrafts.push({
        defectId,
        category: "KONTRADIKSJONSPARTSRETT",
        tier: "T2",
        stage,
        title: "Manglende kontradiktorisk behandling",
        description:
          `Vedtaket i fase ${stage} har ingen registrerte motargumenter. ` +
          `Kan utgjøre brudd på kontradiksjonsprinsippet (fvl. § 16).`,
        confidence,
        ruleId: "R-KONTRADIKSJON-COUNTER-ABSENT",
        meta: { stage, counterEdgeCount: 0 },
        infectNodeIds: []
      });
    }

    return { findings, defectDrafts };
  }
};
