import { NextResponse } from "next/server";
import { getServerDb } from "@/core/server-db";
import { defectCategoryNb, defectTierNb, findingSeverityNb, stageNb } from "@/lib/norwegian-report";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (!caseId) {
      return NextResponse.json({ error: "caseId er påkrevd" }, { status: 400 });
    }

    const db = await getServerDb();

    // Latest run for the case
    const runRes = await db.query(
      `SELECT run_id, started_at, finished_at, input_hash, output_hash
       FROM rule_runs WHERE case_id = $1
       ORDER BY started_at DESC LIMIT 1`,
      [caseId]
    );

    const runId = (runRes.rows[0] as any)?.run_id ?? null;

    // Findings from the latest run
    const findingsRes = runId
      ? await db.query(
          `SELECT finding_id, severity, title, details, rule_id, defect_id, node_ids, excerpt_ids
           FROM findings WHERE run_id = $1
           ORDER BY severity DESC, finding_id ASC`,
          [runId]
        )
      : { rows: [] };

    // Defects for the case
    const defectsRes = await db.query(
      `SELECT defect_id, category, tier, stage, title, description, confidence, rule_id
       FROM defects WHERE case_id = $1
       ORDER BY tier ASC, confidence DESC`,
      [caseId]
    );

    // Remedies
    const remediesRes = await db.query(
      `SELECT r.remedy_id, r.name, r.description, r.typical_deadline, r.jurisdiction, dr.defect_id
       FROM defect_remedies dr
       JOIN remedies r ON r.remedy_id = dr.remedy_id
       JOIN defects d ON d.defect_id = dr.defect_id
       WHERE d.case_id = $1
       ORDER BY dr.defect_id, r.remedy_id`,
      [caseId]
    );

    // Case summary
    const caseRes = await db.query(
      `SELECT case_id, title, locale, created_at, notes FROM cases WHERE case_id = $1`,
      [caseId]
    );

    const findings = (findingsRes.rows as any[]).map((f) => ({
      ...f,
      severity_nb: findingSeverityNb(f.severity),
    }));

    const defects = (defectsRes.rows as any[]).map((d) => ({
      ...d,
      category_nb: defectCategoryNb(d.category),
      tier_nb: defectTierNb(d.tier),
      stage_nb: d.stage ? stageNb(d.stage) : null,
    }));

    return NextResponse.json({
      success: true,
      caseId,
      caseInfo: caseRes.rows[0] ?? null,
      latestRunId: runId,
      latestRunAt: (runRes.rows[0] as any)?.finished_at ?? null,
      findings,
      defects,
      remedies: remediesRes.rows,
      counts: {
        findings: findings.length,
        defects: defects.length,
        critical: findings.filter((f) => f.severity === "CRITICAL").length,
        high: findings.filter((f) => f.severity === "HIGH").length,
      },
    });
  } catch (error: any) {
    console.error("Findings API error:", error);
    return NextResponse.json(
      { error: error.message || "Intern serverfeil" },
      { status: 500 }
    );
  }
}
