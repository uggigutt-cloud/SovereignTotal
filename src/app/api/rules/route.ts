import { NextResponse } from "next/server";
import { getServerDb } from "@/core/server-db";
import { populateCaseGraph } from "@/core/sovereign/graph/graph-populator";
import { normalizeGraphNodeAttributes } from "@/core/sovereign/engine/attribute-normalizer";
import { runRulePackOnCase } from "@/core/sovereign/engine/rule-engine-runner";
import { SovereignCoreRulePack } from "@/core/sovereign/rules/sovereign-core-rulepack";
import { defectCategoryNb, defectTierNb, findingSeverityNb } from "@/lib/norwegian-report";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { caseId, thresholds } = body as {
      caseId: string;
      thresholds?: { independenceMin?: number; ewiMin?: number; contradictionMax?: number };
    };

    if (!caseId) {
      return NextResponse.json({ error: "caseId er påkrevd" }, { status: 400 });
    }

    const db = await getServerDb();

    // Verify case exists
    const caseCheck = await db.query(
      "SELECT case_id FROM cases WHERE case_id = $1",
      [caseId]
    );
    if (!caseCheck.rows.length) {
      return NextResponse.json({ error: "Sak ikke funnet" }, { status: 404 });
    }

    // 1. Build graph from relational tables (includes P1 ASSERTS/DERIVES_FROM edges)
    const populatorSummary = await populateCaseGraph(db, caseId);

    // 2. Normalize node attributes (fill dates, compute EWI, set action flags)
    await normalizeGraphNodeAttributes(db, caseId);

    // 3. Run all 8 Forvaltningsloven rules
    const runSummary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      thresholds,
      strictGraph: false,
    });

    // 4. Fetch findings with Norwegian labels
    const findingsRes = await db.query(
      `SELECT finding_id, severity, title, details, rule_id, defect_id, node_ids, excerpt_ids
       FROM findings WHERE run_id = $1 ORDER BY severity DESC, finding_id ASC`,
      [runSummary.runId]
    );

    // 5. Fetch defects with Norwegian labels
    const defectsRes = await db.query(
      `SELECT defect_id, category, tier, stage, title, description, confidence, rule_id
       FROM defects WHERE case_id = $1 ORDER BY tier ASC, confidence DESC`,
      [caseId]
    );

    // 6. Fetch applicable remedies
    const remediesRes = await db.query(
      `SELECT r.remedy_id, r.name, r.description, r.typical_deadline, r.jurisdiction, dr.defect_id
       FROM defect_remedies dr
       JOIN remedies r ON r.remedy_id = dr.remedy_id
       JOIN defects d ON d.defect_id = dr.defect_id
       WHERE d.case_id = $1
       ORDER BY dr.defect_id, r.remedy_id`,
      [caseId]
    );

    const findings = findingsRes.rows.map((f: any) => ({
      ...f,
      severity_nb: findingSeverityNb(f.severity),
    }));

    const defects = defectsRes.rows.map((d: any) => ({
      ...d,
      category_nb: defectCategoryNb(d.category),
      tier_nb: defectTierNb(d.tier),
    }));

    return NextResponse.json({
      success: true,
      caseId,
      runId: runSummary.runId,
      populatorSummary,
      runSummary: {
        findingCount: runSummary.findingCount,
        defectCount: runSummary.defectCount,
        failedRules: runSummary.failedRules,
      },
      findings,
      defects,
      remedies: remediesRes.rows,
    });
  } catch (error: any) {
    console.error("Rules API error:", error);
    return NextResponse.json(
      { error: error.message || "Intern serverfeil" },
      { status: 500 }
    );
  }
}
