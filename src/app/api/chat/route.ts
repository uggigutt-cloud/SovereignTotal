import { NextResponse } from 'next/server';
import { getGeminiClient } from '@/core/ai/gemini-client';
import { getServerDb } from '@/core/server-db';

export async function POST(req: Request) {
    try {
        const { message, caseId, history = [] } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Missing message' }, { status: 400 });
        }

        // 1. Fetch case context from the Database
        const db = await getServerDb();
        let caseContext = "No specific case selected.";

        if (caseId) {
            // Fetch Nodes
            const nodesRes = await db.query(
                `SELECT type, stage, label, attributes FROM graph_nodes WHERE case_id = $1`,
                [caseId]
            );

            // Fetch Edges
            const edgesRes = await db.query(
                `SELECT type, from_node_id, to_node_id FROM graph_edges WHERE case_id = $1`,
                [caseId]
            );

            // Fetch Case details
            const caseRes = await db.query(
                `SELECT title FROM cases WHERE case_id = $1`,
                [caseId]
            );

            const title = caseRes.rows[0]?.title || caseId;

            caseContext = `
Case Title: ${title}
Case ID: ${caseId}

Total Nodes (Evidence/Decisions): ${nodesRes.rows.length}
Nodes Data: ${JSON.stringify(nodesRes.rows.map(r => ({ type: r.type, title: r.label, stage: r.stage })), null, 2)}

Total Edges (Causality Links): ${edgesRes.rows.length}
Edges Data: ${JSON.stringify(edgesRes.rows, null, 2)}
            `;
        }

        // 2. Initialize Gemini
        const ai = getGeminiClient();

        const systemPrompt = `
You are the Neural Core (The Action Forge) - an advanced LegalTech AI assisting a lawyer.
You are embedded in a Palantir-style Workbench. The user will ask you questions about a specific child welfare (barnevern) case.

Here is the structured SQL data for the currently active case:
---
${caseContext}
---

INSTRUCTIONS:
- Answer the user's questions based ONLY on the case data provided above.
- If they ask for logical defects, use the edges (Causality Links) to find contradictions or unsupported claims.
- Be highly analytical, professional, and concise. Speak in Norwegian.
- Do not make up facts. If the answer is not in the data, state that the evidence does not show it.
`;

        // 3. Format history for Gemini
        const formattedHistory = history.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // 4. Create Chat Session
        const chat = ai.chats.create({
            model: 'gemini-1.5-pro',
            config: {
                systemInstruction: systemPrompt
            }
        });

        // Add history (the SDK manages this gracefully if we send messages sequentially, but for a stateless REST API, we can just pack it into the first message or send history manually)
        let response;
        if (formattedHistory.length > 0) {
            // If there's history, we just send it all as a single appended context for simplicity in this REST demo
            const fullConversation = formattedHistory.map((h: { role: string, parts: { text: string }[] }) => `${h.role}: ${h.parts[0].text}`).join("\n\n");
            response = await chat.sendMessage({ message: `Tidligere samtalelogg:\n${fullConversation}\n\nNytt spørsmål:\n${message}` });
        } else {
            response = await chat.sendMessage({ message });
        }

        return NextResponse.json({
            success: true,
            reply: response.text
        });

    } catch (error: unknown) {
        console.error('Chat API Error:', error);
        const errMes = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errMes }, { status: 500 });
    }
}
