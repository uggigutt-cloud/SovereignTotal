import { NextResponse } from 'next/server';
import { getGeminiClient } from '@/core/ai/gemini-client';
import { getServerDb } from '@/core/server-db';

export async function POST(req: Request) {
  try {
    const { documentText, caseId = `B-${new Date().getFullYear()}-${Math.floor(Math.random() * 999)}`, title = "Ny Saksmappe" } = await req.json();

    if (!documentText) {
      return NextResponse.json({ error: 'Missing documentText' }, { status: 400 });
    }

    const ai = getGeminiClient();

    const prompt = `
You are the Sovereign Neural Core, a LegalTech system analyzing child welfare (barnevern) documents.
Extract the key events from the following document and output them STRICTLY as a JSON object matching this schema:
{
  "nodes": [
    {
      "id": "string (unique)",
      "type": "EVIDENCE" | "HEARING" | "DECISION",
      "stage": "STAGE_A" | "STAGE_B" | "STAGE_C", 
      "label": "string (short title)",
      "attrs": { "description": "string" }
    }
  ],
  "edges": [
    {
      "id": "string (unique)",
      "type": "CAUSES" | "SUPPORTS" | "CONTRADICTS",
      "from": "node_id",
      "to": "node_id",
      "weight": 1.0,
      "attrs": {}
    }
  ]
}

Document Text:
${documentText}
`;

    // Wait for the Gemini model to respond. We use gemini-1.5-pro for deep reasoning.
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text || "{}";
    const graphData = JSON.parse(resultText);

    // Initialize connection to Database
    const db = await getServerDb();

    // 1. Create the Master Case Record in PostgreSQL
    await db.query(
      `INSERT INTO cases (case_id, title, locale) VALUES ($1, $2, 'nb-NO') ON CONFLICT (case_id) DO NOTHING`,
      [caseId, title]
    );

    // 2. Persist the Graph Nodes (Evidence, Decisions, Hearings)
    const { nodes = [], edges = [] } = graphData;
    for (const n of nodes) {
      await db.query(
        `INSERT INTO graph_nodes (node_id, case_id, type, stage, label, attributes)
                 VALUES ($1, $2, $3::node_type, $4::stage_code, $5, $6::jsonb)
                 ON CONFLICT (node_id) DO UPDATE SET label=excluded.label, attributes=excluded.attributes`,
        [n.id, caseId, n.type || 'EVIDENCE', n.stage || 'STAGE_A', n.label || 'Node', JSON.stringify(n.attrs || {})]
      );
    }

    // 3. Persist the Graph Edges (Causality chains)
    for (const e of edges) {
      await db.query(
        `INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight)
                 VALUES ($1, $2, $3::edge_type, $4, $5, 1.0)
                 ON CONFLICT (edge_id) DO NOTHING`,
        [e.id || `${e.from}-${e.to}`, caseId, e.type || 'SUPPORTS', e.from, e.to]
      );
    }

    return NextResponse.json({
      success: true,
      caseId,
      graphData,
      dbStatus: process.env.DATABASE_URL ? "Lagret i Google Cloud SQL (Postgres)" : "Lagret i In-Memory DB (PGLite fallback)"
    });
  } catch (error: any) {
    console.error('Ingest Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
