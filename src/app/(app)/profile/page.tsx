"use client";

import { UserSquare2, Scale, Calendar, FileText, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const caseId = searchParams.get("caseId");

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [findRes, graphRes] = await Promise.all([
        fetch(`/api/findings?caseId=${encodeURIComponent(caseId)}`),
        fetch(`/api/graph?caseId=${encodeURIComponent(caseId)}`),
      ]);
      const [findings, graph] = await Promise.all([findRes.json(), graphRes.json()]);
      if (!findings.success) throw new Error(findings.error);
      setData({ ...findings, nodeCount: graph.nodeCount ?? 0 });
    } catch (e: any) {
      setError(e.message || "Feil ved lasting av saksdata");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!caseId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Velg en sak fra <a href="/cases" className="text-brand-400 underline">Saksoversikt</a>.</p>
      </div>
    );
  }

  const integrityLabel = () => {
    if (!data) return "Ukjent";
    if (data.counts.critical > 0) return "Alvorlig angripelig";
    if (data.counts.high > 0) return "Angripelig";
    if (data.counts.defects > 0) return "Moderat";
    return "Tilfredsstillende";
  };

  const integrityColor = () => {
    if (!data) return "text-slate-400";
    if (data.counts.critical > 0) return "text-rose-400";
    if (data.counts.high > 0) return "text-amber-400";
    if (data.counts.defects > 0) return "text-amber-300";
    return "text-emerald-400";
  };

  return (
    <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-start justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-brand-500/20 flex flex-col items-center justify-center border border-brand-500/30">
              <UserSquare2 size={24} className="text-brand-400 mb-1" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                Saksprofil{" "}
                <span className="text-sm font-mono text-brand-500 bg-brand-500/10 px-2 py-1 rounded">
                  {caseId}
                </span>
              </h1>
              {data?.caseInfo && (
                <p className="text-slate-400 mt-1">{data.caseInfo.title}</p>
              )}
            </div>
          </div>

          {data?.latestRunAt && (
            <div className="glass-panel px-4 py-2 rounded-lg border-emerald-500/30 bg-emerald-500/5">
              <span className="text-xs text-emerald-500 font-mono block mb-1 uppercase tracking-widest">Sist analysert</span>
              <span className="font-bold text-white text-sm">
                {new Date(data.latestRunAt).toLocaleString("nb-NO")}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-3" /> Laster saksdata...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-xl col-span-2 space-y-6">
              <h3 className="font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Scale size={18} className="text-slate-400" /> Saksdetaljer
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saks-ID</div>
                  <div className="font-bold text-white font-mono">{caseId}</div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tittel</div>
                  <div className="font-bold text-white">{data?.caseInfo?.title ?? "—"}</div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg border border-white/5 col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Opprettet</div>
                    <div className="font-bold text-white">
                      {data?.caseInfo?.created_at
                        ? new Date(data.caseInfo.created_at).toLocaleDateString("nb-NO")
                        : "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {data?.counts.critical > 0 && (
                      <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs rounded border border-rose-500/20">
                        {data.counts.critical} Kritisk
                      </span>
                    )}
                    {data?.counts.high > 0 && (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/20">
                        {data.counts.high} Alvorlig
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-xl space-y-6">
              <h3 className="font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Calendar size={18} className="text-slate-400" /> Nøkkeltall
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-slate-400 flex items-center gap-2"><FileText size={16} /> Grafnoder</span>
                  <span className="font-bold text-white text-lg">{data?.nodeCount ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-slate-400 flex items-center gap-2"><AlertTriangle size={16} /> Feil (Defekter)</span>
                  <span className={`font-bold text-lg ${data?.counts?.defects > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {data?.counts?.defects ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-2"><ShieldCheck size={16} /> Prosessuelt helhet</span>
                  <span className={`font-bold text-lg ${integrityColor()}`}>{integrityLabel()}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/portal?caseId=${encodeURIComponent(caseId)}`)}
                className="w-full py-2 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 rounded-lg border border-brand-500/30 transition-colors text-sm font-bold"
              >
                Åpne Saksoversikt
              </button>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="glass-panel p-6 rounded-xl text-center bg-gradient-to-r from-brand-900/10 to-transparent border-l-4 border-l-brand-500">
            <h3 className="text-lg font-bold text-white mb-2">Saksbehandlingen er klar for analyse</h3>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto">
              Gå til <strong>Saksoversikt</strong> for å se defekter og funn, eller{" "}
              <strong>Beviskjede</strong> for å utforske grafnodene.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CaseProfile() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin mr-3" /> Laster...
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
