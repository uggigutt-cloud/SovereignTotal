import { NextResponse } from "next/server";
import { getServerDb } from "@/core/server-db";
import { buildCaseGraphSnapshot } from "@/core/sovereign/graph/graph-builder";
import { nodeTypeNb } from "@/lib/norwegian-report";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (!caseId) {
      return NextResponse.json({ error: "caseId er påkrevd" }, { status: 400 });
    }

    const db = await getServerDb();

    // buildCaseGraphSnapshot reads from graph_nodes + graph_edges
    const snapshot = await buildCaseGraphSnapshot(db, caseId, { strict: false });

    // Annotate nodes with Norwegian labels for the UI
    const nodes = snapshot.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      type_nb: nodeTypeNb(n.type),
      stage: n.stage ?? null,
      label: n.label,
      refId: n.refId,
      attrs: n.attrs,
    }));

    const edges = snapshot.edges.map((e) => ({
      id: e.id,
      type: e.type,
      from: e.from,
      to: e.to,
      weight: e.weight,
    }));

    return NextResponse.json({
      success: true,
      caseId,
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });
  } catch (error: any) {
    console.error("Graph API error:", error);
    return NextResponse.json(
      { error: error.message || "Intern serverfeil" },
      { status: 500 }
    );
  }
}
