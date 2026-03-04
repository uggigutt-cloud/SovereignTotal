import { NextResponse } from "next/server";
import { getGeminiClient } from "@/core/ai/gemini-client";
import { getServerDb } from "@/core/server-db";
import { extractText } from "@/lib/document-parser";
import { populateCaseGraph } from "@/core/sovereign/graph/graph-populator";
import { normalizeGraphNodeAttributes } from "@/core/sovereign/engine/attribute-normalizer";
import { runRulePackOnCase } from "@/core/sovereign/engine/rule-engine-runner";
import { SovereignCoreRulePack } from "@/core/sovereign/rules/sovereign-core-rulepack";

// -----------------------------------------------------------------------
// Gemini structured extraction prompt (Norwegian, correct schema types)
// -----------------------------------------------------------------------
function buildExtractionPrompt(documentText: string): string {
  return `Du er Sovereign Neural Core, et juridisk analysesystem for norsk forvaltningsrett (barnevern).
Analyser følgende norske juridiske dokument og ekstraher strukturerte juridiske noder.

Returner KUN dette JSON-objektet, uten markdown eller forklaringer:
{
  "documents": [
    {
      "doc_id": "string (unikt, f.eks. doc-001)",
      "artifact_type": "PDF" | "DOCX" | "EMAIL" | "NOTE" | "IMAGE" | "TEXT" | "UNKNOWN",
      "filename": "string (filnavnet)",
      "doc_date": "YYYY-MM-DD eller null",
      "stage": "A" | "B" | "C" | "D" | "E" | "F" | "G" | null
    }
  ],
  "excerpts": [
    {
      "excerpt_id": "string (unikt, f.eks. exc-001)",
      "doc_id": "string (tilhørende doc_id)",
      "kind": "NATIVE_TEXT" | "OCR_TEXT" | "ANNOTATION",
      "text": "string (det aktuelle tekstutdraget)",
      "page_no": number | null,
      "language": "nb"
    }
  ],
  "claims": [
    {
      "claim_id": "string (unikt, f.eks. clm-001)",
      "claim_type": "FACT" | "PROCEDURE" | "DECISION" | "HEARSAY" | "INTERPRETATION" | "HYPOTHESIS",
      "stage": "A" | "B" | "C" | "D" | "E" | "F" | "G" | null,
      "claim_text": "string (påstandens innhold)",
      "claim_date": "YYYY-MM-DD eller null",
      "eclass": "E1" | "E2" | "E3" | "E4",
      "subject_ref": "string eller null"
    }
  ],
  "decisions": [
    {
      "decision_id": "string (unikt, f.eks. dec-001)",
      "stage": "A" | "B" | "C" | "D" | "E" | "F" | "G",
      "title": "string (vedtakets tittel)",
      "decided_date": "YYYY-MM-DD eller null",
      "authority": "string (besluttende myndighet)",
      "outcome": "INNVILGET" | "AVSLÅTT" | "HENLEGGELSE" | "DELVIS" | "UKJENT"
    }
  ],
  "claim_excerpts": [
    {
      "claim_id": "string",
      "excerpt_id": "string",
      "relevance": 0.0
    }
  ],
  "claim_derives": [
    {
      "child_claim_id": "string",
      "parent_claim_id": "string"
    }
  ]
}

Stadiene (A-G) betyr:
A=Undersøkelse, B=Hjelpetiltak, C=Akuttvedtak, D=Fylkesnemnd, E=Tingrett, F=Lagmannsrett, G=Høyesterett

Bevisklasser (eclass):
E1=Primærkilde/direktebevis, E2=Indirekte bevis, E3=Annengrads/rapportert, E4=Hypotese/antakelse

Norsk dokument:
${documentText.slice(0, 30000)}`;
}

// -----------------------------------------------------------------------
// Helper: insert relational records from Gemini output
// -----------------------------------------------------------------------
async function insertRelationalData(
  db: Awaited<ReturnType<typeof getServerDb>>,
  caseId: string,
  extracted: any
): Promise<void> {
  const { documents = [], excerpts = [], claims = [], decisions = [], claim_excerpts = [], claim_derives = [] } = extracted;

  for (const doc of documents) {
    if (!doc.doc_id) continue;
    await db.query(
      `INSERT INTO documents (doc_id, case_id, artifact_type, filename, doc_date, stage)
       VALUES ($1, $2, $3::artifact_type, $4, $5::date, $6::stage_code)
       ON CONFLICT (doc_id) DO UPDATE SET artifact_type=excluded.artifact_type, filename=excluded.filename`,
      [
        `${caseId}-${doc.doc_id}`,
        caseId,
        doc.artifact_type || "UNKNOWN",
        doc.filename || doc.doc_id,
        doc.doc_date || null,
        doc.stage || null,
      ]
    );
  }

  for (const exc of excerpts) {
    if (!exc.excerpt_id || !exc.doc_id) continue;
    const docIdRef = `${caseId}-${exc.doc_id}`;
    await db.query(
      `INSERT INTO excerpts (excerpt_id, doc_id, kind, page_no, text, language, char_start, char_end)
       VALUES ($1, $2, $3::excerpt_kind, $4, $5, $6, 0, $7)
       ON CONFLICT (excerpt_id) DO UPDATE SET text=excluded.text`,
      [
        `${caseId}-${exc.excerpt_id}`,
        docIdRef,
        exc.kind || "NATIVE_TEXT",
        exc.page_no ?? null,
        exc.text || "",
        exc.language || "nb",
        (exc.text || "").length,
      ]
    );
  }

  for (const clm of claims) {
    if (!clm.claim_id) continue;
    await db.query(
      `INSERT INTO claims (claim_id, case_id, claim_type, stage, claim_text, claim_date, eclass, subject_ref)
       VALUES ($1, $2, $3::claim_type, $4::stage_code, $5, $6::date, $7::eclass, $8)
       ON CONFLICT (claim_id) DO UPDATE SET claim_text=excluded.claim_text`,
      [
        `${caseId}-${clm.claim_id}`,
        caseId,
        clm.claim_type || "FACT",
        clm.stage || null,
        clm.claim_text || "",
        clm.claim_date || null,
        clm.eclass || "E3",
        clm.subject_ref || null,
      ]
    );
  }

  for (const dec of decisions) {
    if (!dec.decision_id || !dec.stage) continue;
    await db.query(
      `INSERT INTO decisions (decision_id, case_id, stage, title, decided_date, authority, outcome)
       VALUES ($1, $2, $3::stage_code, $4, $5::date, $6, $7)
       ON CONFLICT (decision_id) DO UPDATE SET title=excluded.title, outcome=excluded.outcome`,
      [
        `${caseId}-${dec.decision_id}`,
        caseId,
        dec.stage,
        dec.title || dec.decision_id,
        dec.decided_date || null,
        dec.authority || null,
        dec.outcome || "UKJENT",
      ]
    );
  }

  for (const ce of claim_excerpts) {
    if (!ce.claim_id || !ce.excerpt_id) continue;
    await db.query(
      `INSERT INTO claim_excerpts (claim_id, excerpt_id, relevance)
       VALUES ($1, $2, $3)
       ON CONFLICT (claim_id, excerpt_id) DO UPDATE SET relevance=excluded.relevance`,
      [
        `${caseId}-${ce.claim_id}`,
        `${caseId}-${ce.excerpt_id}`,
        Math.max(0, Math.min(1, ce.relevance ?? 1.0)),
      ]
    );
  }

  for (const cd of claim_derives) {
    if (!cd.child_claim_id || !cd.parent_claim_id) continue;
    await db.query(
      `INSERT INTO claim_derives (child_claim_id, parent_claim_id)
       VALUES ($1, $2)
       ON CONFLICT (child_claim_id, parent_claim_id) DO NOTHING`,
      [`${caseId}-${cd.child_claim_id}`, `${caseId}-${cd.parent_claim_id}`]
    );
  }
}

// -----------------------------------------------------------------------
// POST /api/ingest  — multipart/form-data: file + optional caseId/title
// -----------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let fileBuffer: Buffer;
    let mimeType: string;
    let filename: string;
    let caseId: string;
    let title: string;

    if (contentType.includes("multipart/form-data")) {
      // Real file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Ingen fil ble sendt (feltnavn: file)" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || "application/octet-stream";
      filename = file.name;
      caseId = (formData.get("caseId") as string) || `B-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}-A`;
      title = (formData.get("title") as string) || filename;
    } else {
      // Legacy JSON path for backward compatibility
      const body = await req.json();
      const { documentText, caseId: cid, title: t } = body;
      if (!documentText) {
        return NextResponse.json({ error: "Ingen documentText eller fil sendt" }, { status: 400 });
      }
      fileBuffer = Buffer.from(documentText, "utf-8");
      mimeType = "text/plain";
      filename = "dokument.txt";
      caseId = cid || `B-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}-A`;
      title = t || "Ny Saksmappe";
    }

    // 1. Extract text from document (PDF, DOCX, image, or plain text)
    const parsed = await extractText(fileBuffer, mimeType, filename);

    if (!parsed.text || parsed.text.length < 20) {
      return NextResponse.json(
        { error: "Kunne ikke ekstrahere tekst fra dokumentet. Kontroller at filen er lesbar." },
        { status: 422 }
      );
    }

    // 2. Send to Gemini for structured legal extraction (Norwegian)
    const ai = getGeminiClient();
    const prompt = buildExtractionPrompt(parsed.text);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let extracted: any;
    try {
      const rawText = response.text ?? "{}";
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Gemini returnerte ugyldig JSON. Prøv igjen eller sjekk dokumentet." },
        { status: 502 }
      );
    }

    // 3. Persist to database
    const db = await getServerDb();

    await db.query(
      `INSERT INTO cases (case_id, title, locale) VALUES ($1, $2, 'nb-NO')
       ON CONFLICT (case_id) DO UPDATE SET title=excluded.title`,
      [caseId, title]
    );

    await insertRelationalData(db, caseId, extracted);

    // 4. Build graph from relational tables (P1 pipeline included)
    const populatorSummary = await populateCaseGraph(db, caseId);

    // 5. Normalize node attributes
    await normalizeGraphNodeAttributes(db, caseId);

    // 6. Run rule engine
    const runSummary = await runRulePackOnCase(db, caseId, SovereignCoreRulePack, {
      strictGraph: false,
    });

    return NextResponse.json({
      success: true,
      caseId,
      title,
      documentStats: {
        method: parsed.method,
        textLength: parsed.text.length,
        pageCount: parsed.pageCount,
      },
      extracted: {
        documents: (extracted.documents ?? []).length,
        excerpts: (extracted.excerpts ?? []).length,
        claims: (extracted.claims ?? []).length,
        decisions: (extracted.decisions ?? []).length,
      },
      graph: {
        nodes: populatorSummary.documentNodes + populatorSummary.excerptNodes +
               populatorSummary.claimNodes + populatorSummary.decisionNodes,
        assertsEdges: populatorSummary.assertsEdges,
      },
      ruleEngine: {
        findingCount: runSummary.findingCount,
        defectCount: runSummary.defectCount,
        failedRules: runSummary.failedRules,
      },
      dbStatus: process.env.DATABASE_URL
        ? "Lagret i Google Cloud SQL (Postgres)"
        : "Lagret i In-Memory DB (PGLite fallback)",
    });
  } catch (error: any) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: error.message || "Intern serverfeil" },
      { status: 500 }
    );
  }
}
