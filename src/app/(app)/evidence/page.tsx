"use client";

import { Link2, Search, FileCheck, FileX, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface GraphNode {
  id: string;
  type: string;
  type_nb: string;
  stage: string | null;
  label: string;
  attrs: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  type: string;
  from: string;
  to: string;
  weight: number;
}

function statusForNode(node: GraphNode): "ok" | "defect" | "infected" {
  if (node.type === "DEFECT") return "defect";
  if (node.attrs?.infected === true) return "infected";
  return "ok";
}

function EvidenceContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchGraph = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/graph?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json();
      if (json.success) {
        setNodes(json.nodes);
        setEdges(json.edges);
      } else {
        setError(json.error || "Feil ved henting av grafdata");
      }
    } catch {
      setError("Nettverksfeil");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const filtered = nodes.filter(
    (n) =>
      !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.type_nb.toLowerCase().includes(search.toLowerCase())
  );

  if (!caseId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Velg en sak fra <a href="/cases" className="text-brand-400 underline">Saksoversikt</a> for å se beviskjeden.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Link2 size={28} className="text-emerald-500" />
              Beviskjede
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Analyse av dokumentarisk bevisførelse og lovlighet</p>
            <p className="text-slate-500 mt-1 text-xs font-mono">{nodes.length} noder · {edges.length} kanter</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/5">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                placeholder="Søk bevis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-48 text-white"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-3" /> Laster grafdata...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {nodes.length === 0
              ? "Ingen grafnoder funnet. Last opp et dokument via Ingest for å bygge beviskjeden."
              : "Ingen noder matcher søket."}
          </div>
        ) : (
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/30 text-slate-400 text-xs uppercase font-mono tracking-wider">
                <tr>
                  <th className="px-6 py-4">ID / Type</th>
                  <th className="px-6 py-4">Dokument / Etikett</th>
                  <th className="px-6 py-4">Legalitet / Status</th>
                  <th className="px-6 py-4 text-right">Relasjoner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((node) => {
                  const status = statusForNode(node);
                  const outgoing = edges.filter((e) => e.from === node.id).length;
                  const incoming = edges.filter((e) => e.to === node.id).length;

                  return (
                    <tr key={node.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-mono text-brand-400 text-xs">{node.id.slice(-16)}</div>
                        <div className="text-xs text-slate-500 mt-1">{node.type_nb}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">{node.label}</div>
                        {node.stage && (
                          <div className="text-xs text-slate-500 bg-black/40 inline-block px-2 py-0.5 rounded mt-1 border border-white/5">
                            Stage {node.stage}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {status === "ok" && (
                          <div className="flex items-center gap-2 text-emerald-400">
                            <FileCheck size={16} /> <span className="text-xs font-bold">LEGITIMT</span>
                          </div>
                        )}
                        {status === "defect" && (
                          <div className="flex items-center gap-2 text-rose-400">
                            <FileX size={16} /> <span className="text-xs font-bold">FEIL OPPDAGET</span>
                          </div>
                        )}
                        {status === "infected" && (
                          <div className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle size={16} /> <span className="text-xs font-bold">INFISERT BEVIS</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs text-slate-500 font-mono">↑{incoming} ↓{outgoing}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvidenceChain() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin mr-3" /> Laster...
      </div>
    }>
      <EvidenceContent />
    </Suspense>
  );
}
