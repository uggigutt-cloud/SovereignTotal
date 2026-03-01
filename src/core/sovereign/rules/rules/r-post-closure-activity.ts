// rules/rules/r-post-closure-activity.ts

import { CaseGraphSnapshot, DefectDraft, Finding, Rule, RuleContext } from "../sovereign-rulepack-api";
import { buildIndexes, stableId } from "../graph-utils";

function parseDateISO(d: unknown): number | null {
  if (typeof d !== "string") return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

export const R_POST_CLOSURE_ACTIVITY: Rule = {
  id: "R-STAGEA-POSTCLOSE-ACTIVITY",
  description: "Detects activity after case closure/henleggelse without new formal reopening.",
  evaluate: (graph, ctx) => {
    const g = buildIndexes(graph);
    const findings: Finding[] = [];
    const defectDrafts: DefectDraft[] = [];

    const closures = g.nodes
      .filter(n => n.type === "DECISION" && n.attrs?.["decision_type"] === "HENLEGGELSE")
      .map(n => ({ n, t: parseDateISO(n.attrs?.["decided_date"]) }))
      .filter(x => x.t !== null)
      .sort((a,b) => (a.t! - b.t!));

    if (closures.length === 0) return { findings, defectDrafts };

    for (const c of closures) {
      const closeNode = c.n;
      const closeTime = c.t!;

      const actionsAfter = g.nodes
        .filter(n => (n.type === "CLAIM" || n.type === "EXCERPT") && n.attrs?.["action_flag"] === true)
        .map(n => ({ n, t: parseDateISO(n.attrs?.["event_date"] ?? n.attrs?.["doc_date"]) }))
        .filter(x => x.t !== null && x.t! > closeTime)
        .sort((a,b) => (a.t! - b.t!));

      if (actionsAfter.length === 0) continue;

      const firstAction = actionsAfter[0];
      if (!firstAction) continue;
      const firstActionTime = firstAction.t!;
      const hasReopenBeforeFirstAction =
        g.nodes.some(n =>
          n.type === "DECISION" &&
          n.attrs?.["decision_type"] === "NY_SAK" &&
          (() => {
            const rt = parseDateISO(n.attrs?.["decided_date"]);
            return rt !== null && rt > closeTime && rt < firstActionTime;
          })()
        );

      if (hasReopenBeforeFirstAction) continue;

      const defectId = stableId("defect", [ctx.rulepackId, ctx.version, "POSTCLOSE", closeNode.id]);
      const findingId = stableId("finding", [ctx.rulepackId, ctx.version, "POSTCLOSE", closeNode.id]);

      const actionNodeIds = actionsAfter.slice(0, 8).map(x => x.n.id);
      const excerptIds = actionsAfter.filter(x => x.n.type === "EXCERPT").slice(0, 8).map(x => x.n.refId);

      findings.push({
        id: findingId,
        severity: "CRITICAL",
        title: "Hjemmelsrisiko: aktivitet etter henleggelse uten ny formell sak",
        details:
          `Henleggelse registrert (${String(closeNode.attrs?.["decided_date"])}). ` +
          `Påvist aktive handlinger etter henleggelse uten dokumentert ny saksåpning før første handling.`,
        ruleId: "R-STAGEA-POSTCLOSE-ACTIVITY",
        defectId,
        nodeIds: [closeNode.id, ...actionNodeIds],
        excerptIds,
        evidence: {
          triggeredBy: ["CLOSURE_FOUND", "ACTION_AFTER_CLOSURE", "NO_REOPEN_BEFORE_ACTION"],
          thresholds: {},
          computed: { closureDate: String(closeNode.attrs?.["decided_date"]), actionCount: actionsAfter.length }
        }
      });

      defectDrafts.push({
        defectId,
        category: "HOMELESMANGEL",
        tier: "T1",
        stage: closeNode.stage ?? "A",
        title: "Primærfeil: aktivitet etter henleggelse uten ny sak",
        description:
          "Aktiv handling etter henleggelse uten dokumentert ny saksåpning før handling. Kandidat for hjemmels-/kompetansesvikt og kjedekontaminasjon.",
        confidence: 0.85,
        ruleId: "R-STAGEA-POSTCLOSE-ACTIVITY",
        primaryExcerptId: excerptIds[0],
        meta: { closureNodeId: closeNode.id, sampleActionNodeIds: actionNodeIds },
        infectNodeIds: actionNodeIds
      });
    }

    return { findings, defectDrafts };
  }
};
