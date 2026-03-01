// rules/rules/r-kompetansemangel.ts

import type { DefectDraft, Finding, Rule, StageCode } from "../sovereign-rulepack-api";
import { buildIndexes, stableId } from "../graph-utils";

export const R_KOMPETANSEMANGEL: Rule = {
  id: "R-KOMPETANSE-UNAUTHORIZED-STAGE",
  description: "Detects DECISION nodes where the authority attribute does not match the allowed authorities for the stage.",
  citation: "Forvaltningsloven § 6 og delegasjonsregler — forvaltningsorgan og kompetanse",
  kind: "PROCEDURAL",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    // Gracefully skip if no authority constraints are configured by the caller.
    if (!ctx.authorityConstraints) return { findings, defectDrafts };
    const constraints = ctx.authorityConstraints;

    const candidates = g.nodes
      .filter(n =>
        n.type === "DECISION" &&
        n.stage != null &&
        typeof n.attrs?.["authority"] === "string"
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const n of candidates) {
      const stage = n.stage as StageCode;
      const authority = n.attrs["authority"] as string;
      const allowedAuthorities = constraints[stage];

      if (!allowedAuthorities) continue; // no constraint configured for this stage
      if (allowedAuthorities.includes(authority)) continue; // authority is authorised

      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "KOMPETANSE", n.id, authority]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "KOMPETANSE", n.id, authority]);

      findings.push({
        id: findingId,
        severity: "HIGH",
        title: "Kompetansemangel: vedtak av ikke-autorisert myndighet",
        details:
          `DECISION ${n.id} (stage=${stage}) er signert av "${authority}", ` +
          `som ikke er blant tillatte myndigheter for stadiet: [${allowedAuthorities.join(", ")}].`,
        ruleId: "R-KOMPETANSE-UNAUTHORIZED-STAGE",
        defectId,
        nodeIds: [n.id],
        excerptIds: [],
        evidence: {
          triggeredBy: ["UNAUTHORIZED_AUTHORITY"],
          thresholds: {},
          computed: { stage, authority, allowedCount: allowedAuthorities.length }
        }
      });

      defectDrafts.push({
        defectId,
        category: "KOMPETANSEMANGEL",
        tier: "T2",
        stage,
        title: "Vedtak av ikke-delegert myndighet",
        description:
          `Autoritet "${authority}" er ikke delegert til å avgjøre saker i fase ${stage}. ` +
          `Vedtaket kan mangle hjemmel.`,
        confidence: 0.85,
        ruleId: "R-KOMPETANSE-UNAUTHORIZED-STAGE",
        meta: { authority, stage, allowedAuthorities },
        infectNodeIds: [n.id]
      });
    }

    return { findings, defectDrafts };
  }
};
