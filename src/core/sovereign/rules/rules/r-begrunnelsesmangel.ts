// rules/rules/r-begrunnelsesmangel.ts

import type { DefectDraft, Finding, Rule, RuleContext } from "../sovereign-rulepack-api";
import { buildIndexes, out, stableId } from "../graph-utils";

export const R_BEGRUNNELSE: Rule = {
  id: "R-BEGRUNNELSE-MISSING-LEGAL-BASIS",
  description: "Detects DECISION nodes that cite no legal basis (no VIOLATES or REFERENCES edges to RULE nodes).",
  citation: "Forvaltningsloven § 25 — begrunnelsesplikt",
  kind: "PROCEDURAL",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    const decisions = g.nodes
      .filter(n => n.type === "DECISION")
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const n of decisions) {
      const outViolates = out(g, n.id, "VIOLATES");
      const outReferences = out(g, n.id, "REFERENCES");
      if (outViolates.length > 0 || outReferences.length > 0) continue;

      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "BEGRUNNELSE", n.id]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "BEGRUNNELSE", n.id]);

      findings.push({
        id: findingId,
        severity: "HIGH",
        title: "Begrunnelsesmangel: vedtak uten tilknyttet rettslig grunnlag",
        details:
          `Node ${n.id} (${n.label}) har ingen utgående VIOLATES- eller REFERENCES-kanter ` +
          `til RULE-noder. Vedtaket mangler dokumentert rettslig grunnlag.`,
        ruleId: "R-BEGRUNNELSE-MISSING-LEGAL-BASIS",
        defectId,
        nodeIds: [n.id],
        excerptIds: [],
        evidence: {
          triggeredBy: ["DECISION_NO_LEGAL_BASIS"],
          thresholds: {},
          computed: { outViolates: outViolates.length, outReferences: outReferences.length }
        }
      });

      defectDrafts.push({
        defectId,
        category: "BEGRUNNELSESMANGEL",
        tier: "T2",
        stage: n.stage,
        title: "Manglende rettslig grunnlag i vedtak",
        description:
          "Vedtaket har ingen registrert tilknytning til lovhjemmel eller rettskilde. " +
          "Kan utgjøre en begrunnelsessvikt etter fvl. § 25.",
        confidence: 0.75,
        ruleId: "R-BEGRUNNELSE-MISSING-LEGAL-BASIS",
        meta: { decisionNodeId: n.id, label: n.label },
        infectNodeIds: []
      });
    }

    return { findings, defectDrafts };
  }
};
