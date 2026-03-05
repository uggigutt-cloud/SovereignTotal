"use client";

import { CheckCircle2, AlertTriangle, XCircle, Activity, FileText, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Defect {
  defect_id: string;
  category: string;
  category_nb: string;
  tier: string;
  tier_nb: string;
  stage: string | null;
  stage_nb: string | null;
  title: string;
  description: string;
  confidence: number;
}

interface FindingsData {
  caseId: string;
  caseInfo: { title: string; locale: string; created_at: string } | null;
  latestRunId: string | null;
  latestRunAt: string | null;
  findings: any[];
  defects: Defect[];
  remedies: any[];
  counts: { findings: number; defects: number; critical: number; high: number };
}

function PortalContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [data, setData] = useState<FindingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFindings = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/findings?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Feil ved henting av analysedata");
      }
    } catch {
      setError("Nettverksfeil");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    // Fetch findings first; if no run exists yet, auto-trigger the rule engine
    const loadAndAutoRun = async () => {
      if (!caseId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/findings?caseId=${encodeURIComponent(caseId)}`);
        const json = await res.json();
        if (json.success) {
          if (json.latestRunId === null) {
            // No analysis run yet — run automatically
            setRunning(true);
            try {
              const r2 = await fetch("/api/rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ caseId }),
              });
              const j2 = await r2.json();
              if (!j2.success) setError(j2.error || "Feil ved kjøring av regelmotor");
            } finally {
              setRunning(false);
            }
            // Re-fetch after auto-run
            const res3 = await fetch(`/api/findings?caseId=${encodeURIComponent(caseId)}`);
            const j3 = await res3.json();
            if (j3.success) setData(j3);
            else setError(j3.error || "Feil ved henting av analysedata");
          } else {
            setData(json);
          }
        } else {
          setError(json.error || "Feil ved henting av analysedata");
        }
      } catch {
        setError("Nettverksfeil");
      } finally {
        setLoading(false);
      }
    };
    loadAndAutoRun();
  }, [caseId]);

  const runAnalysis = async () => {
    if (!caseId) return;
    setRunning(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchFindings();
      } else {
        setError(json.error || "Feil ved kjøring av regelmotor");
      }
    } catch {
      setError("Nettverksfeil under regelanalyse");
    } finally {
      setRunning(false);
    }
  };

  const healthScore = data
    ? Math.max(0, Math.round(100 - data.counts.critical * 25 - data.counts.high * 10))
    : null;

  if (!caseId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Velg en sak fra <a href="/cases" className="text-brand-400 underline">Saksoversikt</a> for å se analysen.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-12 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Sovereign<span className="text-brand-500">Portal</span>
          </h1>
          <p className="text-sm text-slate-500 font-mono">{caseId}</p>
          {data?.caseInfo && (
            <p className="text-sm text-slate-400 mt-1">{data.caseInfo.title}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {healthScore !== null && (
            <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-3">
              <span className="text-sm text-slate-400">Prosessuell helhet</span>
              <div className={`flex items-center gap-1.5 font-bold ${healthScore >= 70 ? "text-emerald-400" : healthScore >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                <Activity size={16} /> {healthScore}%
              </div>
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {running ? "Analyserer..." : "Kjør Regelmotor"}
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500">
          <Loader2 size={24} className="animate-spin mr-3" /> Laster inn analysedata...
        </div>
      ) : (
        <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel p-6 rounded-xl space-y-4">
              <h3 className="font-semibold text-white border-b border-white/10 pb-2">Sakssammendrag</h3>

              {data && data.counts.defects === 0 ? (
                <p className="text-sm text-slate-400">Ingen feil oppdaget i denne saken.</p>
              ) : data ? (
                <p className="text-sm text-slate-400 leading-relaxed">
                  Regelmotor har funnet{" "}
                  <span className="text-rose-400 font-medium">{data.counts.defects} saksbehandlingsfeil</span>{" "}
                  i saken.
                </p>
              ) : (
                <p className="text-sm text-slate-400">Kjør regelmotor for å analysere saken.</p>
              )}

              {data && (
                <div className="pt-2 space-y-2">
                  {data.counts.critical > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <XCircle size={16} className="text-rose-500" />
                      <span className="text-rose-400">{data.counts.critical} kritiske feil</span>
                    </div>
                  )}
                  {data.counts.high > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <span className="text-amber-400">{data.counts.high} alvorlige feil</span>
                    </div>
                  )}
                  {data.counts.critical === 0 && data.counts.high === 0 && data.counts.defects > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>Kun moderate/lave feil funnet</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {data && data.remedies.length > 0 && (
              <div className="glass-panel p-6 rounded-xl space-y-4">
                <h3 className="font-semibold text-white border-b border-white/10 pb-2">Rettsmidler</h3>
                <div className="space-y-2">
                  {data.remedies.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-transparent hover:border-white/5">
                      <FileText size={14} className="text-brand-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-slate-300 font-medium">{r.name}</p>
                        {r.typical_deadline && (
                          <p className="text-xs text-slate-500 mt-0.5">Frist: {r.typical_deadline}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Defect timeline */}
          <div className="lg:col-span-2">
            <div className="glass-panel p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-6">Feil og Funn</h2>

              {!data || data.defects.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {data ? "Ingen feil oppdaget — saken ser prosessuelt korrekt ut." : "Kjør regelmotor for å analysere saken."}
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-800 ml-4 space-y-8 pb-4">
                  {data.defects.map((defect) => (
                    <div key={defect.defect_id} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-dark-900 ${
                        defect.tier === "T1" ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]" :
                        defect.tier === "T2" ? "bg-amber-500" : "bg-slate-500"
                      }`} />
                      <div className="mb-1 text-xs font-mono text-slate-500">
                        {defect.stage_nb ?? "Ukjent fase"} — {defect.tier_nb}
                      </div>
                      <div className={`p-4 rounded-lg border ${
                        defect.tier === "T1"
                          ? "bg-rose-500/10 border-rose-500/20"
                          : "bg-amber-500/10 border-amber-500/20"
                      }`}>
                        <h4 className={`text-md font-semibold ${defect.tier === "T1" ? "text-rose-400" : "text-amber-400"}`}>
                          {defect.title}
                        </h4>
                        <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                          {defect.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/30 text-xs font-mono text-slate-400 border border-white/5">
                            {defect.category_nb}
                          </span>
                          <span className="text-xs text-slate-500">
                            Konfidensgrad: {Math.round(defect.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default function SovereignPortal() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin mr-3" /> Laster...
      </div>
    }>
      <PortalContent />
    </Suspense>
  );
}
