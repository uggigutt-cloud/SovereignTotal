// rules/rules/r-chain-contamination.ts

import { CaseGraphSnapshot, DefectDraft, Finding, Rule, RuleContext } from "../sovereign-rulepack-api";
import { buildIndexes, inn, node, out, stableId } from "../graph-utils";

export const R_CHAIN_CONTAMINATION: Rule = {
  id: "R-CHAIN-CONTAMINATION",
  description: "Flags derived nodes that rely on infected/invalid sources without independent evidence (Tier 3).",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    const independenceMin = ctx.thresholds.independenceMin;
    const ewiMin = ctx.thresholds.ewiMin;

    const isInfected = (nid: string): boolean => {
      // Use pre-computed multi-hop set when available (set by rule-engine-runner).
      if (g.infectedSet) return g.infectedSet.has(nid);
      // Fallback for unit tests that pass a plain snapshot without infectedSet.
      const n = node(g, nid);
      if (!n) return false;
      if (n.attrs?.["infected"] === true) return true;
      return inn(g, nid, "INFECTS").length > 0;
    };

    const candidates = g.nodes
      .filter(n => n.type === "CLAIM" || n.type === "DECISION")
      .sort((a,b) => a.id.localeCompare(b.id));

    for (const n of candidates) {
      const derives = out(g, n.id, "DERIVES_FROM");
      if (derives.length === 0) continue;

      const parents = derives.map(e => e.to).sort();
      const infectedParents = parents.filter(pid => isInfected(pid));
      if (infectedParents.length === 0) continue;

      const independence = Number(n.attrs?.["independence_score"] ?? 0);
      const ewi = Number(n.attrs?.["ewi"] ?? 0);

      const lacksIndependentSupport = independence < independenceMin || ewi < ewiMin;
      if (!lacksIndependentSupport) continue;

      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "T3", n.id, infectedParents.join(",")]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "T3", n.id]);

      const excerptIds: string[] = [];
      for (const e of inn(g, n.id)) {
        if (e.type === "ASSERTS" || e.type === "SUPPORTS") {
          const src = node(g, e.from);
          if (src?.type === "EXCERPT") excerptIds.push(src.refId);
        }
      }

      findings.push({
        id: findingId,
        severity: "HIGH",
        title: "Kjede-kontaminasjon: avledet grunnlag uten uavhengig evidens",
        details:
          `Node ${n.id} deriverer fra INFECTED parent(s): ${infectedParents.join(", ")}. ` +
          `independence_score=${independence.toFixed(2)} (min ${independenceMin}), ewi=${ewi.toFixed(2)} (min ${ewiMin}).`,
        ruleId: "R-CHAIN-CONTAMINATION",
        defectId,
        nodeIds: [n.id, ...infectedParents],
        excerptIds,
        evidence: {
          triggeredBy: ["DERIVES_FROM_INFECTED", "INSUFFICIENT_INDEPENDENCE"],
          thresholds: { independenceMin, ewiMin },
          computed: { independence, ewi, infectedParentCount: infectedParents.length }
        }
      });

      defectDrafts.push({
        defectId,
        category: "HOMELESMANGEL",
        tier: "T3",
        stage: n.stage,
        title: "Derivert ugyldighet: kontaminert premisskjede",
        description:
          `Avledet grunnlag fra kontaminert kilde uten dokumentert uavhengig evidens.`,
        confidence: Math.max(0.60, Math.min(0.95, (1 - independence) * 0.7 + (1 - ewi) * 0.3)),
        ruleId: "R-CHAIN-CONTAMINATION",
        primaryExcerptId: excerptIds[0],
        meta: { infectedParents, independence, ewi, model: "Sovereign Tier3" },
        infectNodeIds: [n.id]
      });
    }

    return { findings, defectDrafts };
  }
};
