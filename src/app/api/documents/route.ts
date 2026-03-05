import { NextResponse } from "next/server";
import { getServerDb } from "@/core/server-db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (!caseId) {
      return NextResponse.json({ error: "caseId er påkrevd" }, { status: 400 });
    }

    const db = await getServerDb();

    const docsRes = await db.query(
      `SELECT doc_id, artifact_type, filename, doc_date, stage
       FROM documents WHERE case_id = $1
       ORDER BY doc_date ASC NULLS LAST, doc_id ASC`,
      [caseId]
    );

    const excerptRes = await db.query(
      `SELECT e.excerpt_id, e.doc_id, e.kind, e.page_no, e.text, e.language
       FROM excerpts e
       JOIN documents d ON d.doc_id = e.doc_id
       WHERE d.case_id = $1
       ORDER BY e.doc_id, e.page_no ASC NULLS LAST`,
      [caseId]
    );

    const claimsRes = await db.query(
      `SELECT claim_id, claim_type, stage, claim_text, claim_date, eclass, subject_ref
       FROM claims WHERE case_id = $1
       ORDER BY claim_date ASC NULLS LAST, claim_id ASC`,
      [caseId]
    );

    const excerptsByDoc: Record<string, any[]> = {};
    for (const exc of excerptRes.rows as any[]) {
      if (!excerptsByDoc[exc.doc_id]) excerptsByDoc[exc.doc_id] = [];
      excerptsByDoc[exc.doc_id].push(exc);
    }

    const documents = (docsRes.rows as any[]).map((doc) => ({
      ...doc,
      excerpts: excerptsByDoc[doc.doc_id] ?? [],
    }));

    return NextResponse.json({
      success: true,
      caseId,
      documents,
      claims: claimsRes.rows,
      totalExcerpts: excerptRes.rows.length,
    });
  } catch (error: any) {
    console.error("Documents API error:", error);
    return NextResponse.json(
      { error: error.message || "Intern serverfeil" },
      { status: 500 }
    );
  }
}
