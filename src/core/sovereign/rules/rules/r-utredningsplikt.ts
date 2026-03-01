// rules/rules/r-utredningsplikt.ts

import type { DefectDraft, Finding, Rule, StageCode } from "../sovereign-rulepack-api";
import { buildIndexes, inn, node, stableId } from "../graph-utils";

const EARLY_STAGES = new Set<StageCode>(["A", "B"]);
const FACTUAL_TYPES = new Set(["FACT", "PROCEDURE"]);

export const R_UTREDNINGSPLIKT: Rule = {
  id: "R-UTREDNING-ENTITY-GAP",
  description: "Detects FACT or PROCEDURE claims at stage A/B with no supporting EXCERPT nodes.",
  citation: "Forvaltningsloven § 17 — utredningsplikt",
  kind: "PROCEDURAL",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    const candidates = g.nodes
      .filter(n =>
        n.type === "CLAIM" &&
        typeof n.attrs?.["claim_type"] === "string" &&
        FACTUAL_TYPES.has(n.attrs["claim_type"] as string) &&
        n.stage != null &&
        EARLY_STAGES.has(n.stage)
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const n of candidates) {
      const supportingExcerpts = inn(g, n.id, "ASSERTS")
        .concat(inn(g, n.id, "SUPPORTS"))
        .filter(e => node(g, e.from)?.type === "EXCERPT");

      if (supportingExcerpts.length > 0) continue;

      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "UTREDNING", n.id]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "UTREDNING", n.id]);

      findings.push({
        id: findingId,
        severity: "HIGH",
        title: "Utredningspliktbrudd: faktapåstand uten dokumentasjonskilde",
        details:
          `CLAIM ${n.id} (type=${String(n.attrs?.["claim_type"])}, stage=${n.stage}) ` +
          `har ingen innkommende ASSERTS/SUPPORTS-kanter fra EXCERPT-noder.`,
        ruleId: "R-UTREDNING-ENTITY-GAP",
        defectId,
        nodeIds: [n.id],
        excerptIds: [],
        evidence: {
          triggeredBy: ["CLAIM_NO_EXCERPT_SUPPORT"],
          thresholds: {},
          computed: {
            claimType: String(n.attrs?.["claim_type"]),
            stage: n.stage ?? ""
          }
        }
      });

      defectDrafts.push({
        defectId,
        category: "UTREDNINGSPLIKTBRUDD",
        tier: "T2",
        stage: n.stage,
        title: "Udokumentert faktapåstand i tidlig fase",
        description:
          "Faktapåstanden mangler kildebelegg fra tilknyttede dokumentutdrag. " +
          "Mulig brudd på forvaltningslovens utredningsplikt (§ 17).",
        confidence: 0.70,
        ruleId: "R-UTREDNING-ENTITY-GAP",
        meta: { claimType: n.attrs?.["claim_type"], stage: n.stage },
        infectNodeIds: []
      });
    }

    return { findings, defectDrafts };
  }
};
