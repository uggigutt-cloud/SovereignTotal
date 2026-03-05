"use client";

import { Network, Bot, Send, Loader2, ShieldAlert, AlertTriangle, FileText, GitBranch } from "lucide-react";
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

interface Defect {
  defect_id: string;
  category_nb: string;
  tier: string;
  tier_nb: string;
  stage_nb: string | null;
  title: string;
  description: string;
  confidence: number;
}

function WorkbenchContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

  const [chatMessage, setChatMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatLog, setChatLog] = useState<{ role: string; text: string }[]>([
    {
      role: "agent",
      text: "Sovereign Neural Core online. Velg en sak fra Saksoversikt for å laste inn saksdata, og still spørsmål om dokumentene eller funnene.",
    },
  ]);

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setGraphLoading(true);
    try {
      const [graphRes, findRes] = await Promise.all([
        fetch(`/api/graph?caseId=${encodeURIComponent(caseId)}`),
        fetch(`/api/findings?caseId=${encodeURIComponent(caseId)}`),
      ]);
      const [graphJson, findJson] = await Promise.all([graphRes.json(), findRes.json()]);
      if (graphJson.success) {
        setNodes(graphJson.nodes);
        setEdges(graphJson.edges);
      }
      if (findJson.success) {
        setDefects(findJson.defects);
      }
    } finally {
      setGraphLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isLoading) return;

    const userText = chatMessage;
    setChatLog((prev) => [...prev, { role: "user", text: userText }]);
    setChatMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          caseId: caseId || null,
          history: chatLog.map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      const data = await response.json();
      setChatLog((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.reply || "Systemfeil: " + (data.error || "Ingen respons"),
        },
      ]);
    } catch {
      setChatLog((prev) => [
        ...prev,
        { role: "agent", text: "Nettverksfeil: Klarte ikke kontakte serveren." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const t1 = defects.filter((d) => d.tier === "T1").length;
  const t2plus = defects.filter((d) => d.tier !== "T1").length;
  const totalBar = t1 + t2plus || 1;

  return (
    <div className="h-full flex flex-col bg-dark-900 text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-dark-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-brand-500 font-bold bg-brand-900/40 px-3 py-1 rounded border border-brand-500/20">
            <Network size={16} />
            Kausalitetskjede
          </div>
          {caseId && <span className="text-xs font-mono text-slate-500">{caseId}</span>}
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {nodes.length} noder · {edges.length} kanter · {defects.length} feil
        </div>
      </header>

      {!caseId ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <p>
            Velg en sak fra{" "}
            <a href="/cases" className="text-brand-400 underline">
              Saksoversikt
            </a>{" "}
            for å bruke Workbench.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: defects + nodes */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Summary bar */}
            <div className="flex gap-4 p-4 border-b border-white/5 shrink-0">
              <div className="glass-panel px-4 py-3 rounded-lg flex items-center gap-3 flex-1">
                <ShieldAlert size={16} className="text-rose-400" />
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Kritiske feil (T1)</div>
                  <div className="text-xl font-bold text-rose-400">{t1}</div>
                </div>
              </div>
              <div className="glass-panel px-4 py-3 rounded-lg flex items-center gap-3 flex-1">
                <AlertTriangle size={16} className="text-amber-400" />
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Moderate feil (T2/T3)</div>
                  <div className="text-xl font-bold text-amber-400">{t2plus}</div>
                </div>
              </div>
              <div className="glass-panel px-4 py-3 rounded-lg flex items-center gap-3 flex-1">
                <GitBranch size={16} className="text-brand-400" />
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Grafkanter</div>
                  <div className="text-xl font-bold text-brand-400">{edges.length}</div>
                </div>
              </div>
              <div className="glass-panel px-4 py-3 rounded-lg flex items-center gap-3 flex-1">
                <FileText size={16} className="text-emerald-400" />
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Grafnoder</div>
                  <div className="text-xl font-bold text-emerald-400">{nodes.length}</div>
                </div>
              </div>
            </div>

            {/* Two-column: defects + nodes */}
            <div className="flex-1 flex overflow-hidden">
              {/* Defects */}
              <div className="w-1/2 border-r border-white/5 overflow-y-auto p-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
                  Registrerte feil ({defects.length})
                </h3>
                {graphLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Laster...
                  </div>
                ) : defects.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Ingen feil funnet. Kjør regelmotor fra{" "}
                    <a
                      href={`/portal?caseId=${encodeURIComponent(caseId)}`}
                      className="text-brand-400 underline"
                    >
                      Nexus Tidslinje
                    </a>{" "}
                    først.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {defects.map((d) => (
                        <div
                          key={d.defect_id}
                          className={`p-3 rounded-lg border text-sm ${
                            d.tier === "T1"
                              ? "bg-rose-500/10 border-rose-500/20"
                              : "bg-amber-500/10 border-amber-500/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span
                              className={`font-semibold ${
                                d.tier === "T1" ? "text-rose-400" : "text-amber-400"
                              }`}
                            >
                              {d.title}
                            </span>
                            <span className="text-xs font-mono text-slate-500 shrink-0">{d.tier}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{d.description}</p>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {d.stage_nb && (
                              <span className="px-2 py-0.5 bg-black/30 text-xs text-slate-500 rounded border border-white/5">
                                {d.stage_nb}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-black/30 text-xs text-slate-500 rounded border border-white/5">
                              {d.category_nb}
                            </span>
                            <span className="text-xs text-slate-600">
                              {Math.round(d.confidence * 100)}% konfidensgrad
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs text-slate-500 mb-1">Fordeling</div>
                      <div className="h-2 w-full bg-dark-950 rounded-full flex overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${(t1 / totalBar) * 100}%` }}
                        />
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${(t2plus / totalBar) * 100}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Nodes */}
              <div className="w-1/2 overflow-y-auto p-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
                  Grafnoder ({nodes.length})
                </h3>
                {graphLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Laster...
                  </div>
                ) : nodes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Ingen grafnoder. Last opp et dokument via Ingest.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {nodes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                            n.type === "DEFECT"
                              ? "bg-rose-500"
                              : n.type === "CLAIM"
                              ? "bg-brand-500"
                              : n.type === "DECISION"
                              ? "bg-amber-500"
                              : "bg-slate-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-300 truncate">{n.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono flex gap-2">
                            <span>{n.type_nb}</span>
                            {n.stage && <span>· Stage {n.stage}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Chat */}
          <div className="w-[380px] border-l border-white/10 bg-dark-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-dark-900/50">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 border border-brand-500/30">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Neural Core</h3>
                <p className="text-[10px] text-brand-400 font-mono uppercase">
                  {caseId ? "Saksdata lastet" : "Ingen sak valgt"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm leading-relaxed">
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[90%] whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-brand-600 text-white shadow-md"
                        : "bg-white/5 text-slate-300 border border-white/10"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="p-3 rounded-xl bg-white/5 text-slate-400 border border-white/10 italic text-xs flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Neural Core analyserer...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-dark-900/50">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  disabled={isLoading}
                  placeholder={
                    !caseId
                      ? "Velg en sak først..."
                      : isLoading
                      ? "Venter på svar..."
                      : "Spør om saken, funn eller lovhjemler..."
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || isLoading || !caseId}
                  className="absolute right-2 p-1.5 rounded-md text-brand-500 hover:bg-brand-500/20 disabled:opacity-30 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Workbench() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin mr-3" /> Laster...
        </div>
      }
    >
      <WorkbenchContent />
    </Suspense>
  );
}
