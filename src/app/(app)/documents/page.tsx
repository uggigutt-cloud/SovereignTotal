"use client";

import { FileText, ChevronDown, ChevronRight, BookOpen, Loader2, Tag } from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Excerpt {
  excerpt_id: string;
  doc_id: string;
  kind: string;
  page_no: number | null;
  text: string;
  language: string;
}

interface Document {
  doc_id: string;
  artifact_type: string;
  filename: string;
  doc_date: string | null;
  stage: string | null;
  excerpts: Excerpt[];
}

interface Claim {
  claim_id: string;
  claim_type: string;
  stage: string | null;
  claim_text: string;
  claim_date: string | null;
  eclass: string;
  subject_ref: string | null;
}

const eclassLabel: Record<string, string> = {
  E1: "Primærkilde / Direktebevis",
  E2: "Indirekte bevis",
  E3: "Annengrads / Rapportert",
  E4: "Hypotese / Antakelse",
};

const claimTypeLabel: Record<string, string> = {
  FACT: "Faktum",
  PROCEDURE: "Prosessuell handling",
  DECISION: "Vedtak",
  HEARSAY: "Høresekunder",
  INTERPRETATION: "Tolkning",
  HYPOTHESIS: "Hypotese",
};

const stageLabel: Record<string, string> = {
  A: "A – Undersøkelse",
  B: "B – Hjelpetiltak",
  C: "C – Akuttvedtak",
  D: "D – Fylkesnemnd",
  E: "E – Tingrett",
  F: "F – Lagmannsrett",
  G: "G – Høyesterett",
};

function DocumentsContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [documents, setDocuments] = useState<Document[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDocs, setOpenDocs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"documents" | "claims">("documents");

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents?caseId=${encodeURIComponent(caseId)}`);
      const json = await res.json();
      if (json.success) {
        setDocuments(json.documents);
        setClaims(json.claims);
        // Auto-open first document
        if (json.documents.length > 0) {
          setOpenDocs(new Set([json.documents[0].doc_id]));
        }
      } else {
        setError(json.error || "Feil ved henting av dokumenter");
      }
    } catch {
      setError("Nettverksfeil");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleDoc(docId: string) {
    setOpenDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  if (!caseId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>
          Velg en sak fra{" "}
          <a href="/cases" className="text-brand-400 underline">
            Saksoversikt
          </a>{" "}
          for å se dokumentene.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen size={28} className="text-brand-500" />
              Dokumentvisning
            </h1>
            <p className="text-slate-400 mt-2 text-sm font-mono">{caseId}</p>
            <p className="text-slate-500 text-xs mt-1">
              {documents.length} dokument(er) · {documents.reduce((s, d) => s + d.excerpts.length, 0)} tekstutdrag · {claims.length} påstander
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "documents"
                  ? "bg-brand-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              Dokumenter
            </button>
            <button
              onClick={() => setActiveTab("claims")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "claims"
                  ? "bg-brand-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              Påstander ({claims.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-3" /> Laster dokumenter...
          </div>
        ) : activeTab === "documents" ? (
          documents.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Ingen dokumenter funnet for denne saken. Last opp via Ingest.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => {
                const isOpen = openDocs.has(doc.doc_id);
                return (
                  <div key={doc.doc_id} className="glass-panel rounded-xl border border-white/5 overflow-hidden">
                    {/* Document header */}
                    <button
                      onClick={() => toggleDoc(doc.doc_id)}
                      className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                          <FileText size={18} className="text-brand-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{doc.filename}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                            <span className="font-mono">{doc.artifact_type}</span>
                            {doc.doc_date && <span>{new Date(doc.doc_date).toLocaleDateString("nb-NO")}</span>}
                            {doc.stage && <span className="text-brand-400">{stageLabel[doc.stage] ?? doc.stage}</span>}
                            <span>{doc.excerpts.length} tekstutdrag</span>
                          </div>
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>

                    {/* Excerpts */}
                    {isOpen && (
                      <div className="border-t border-white/5">
                        {doc.excerpts.length === 0 ? (
                          <p className="p-5 text-sm text-slate-500">Ingen tekstutdrag tilgjengelig for dette dokumentet.</p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {doc.excerpts.map((exc) => (
                              <div key={exc.excerpt_id} className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  {exc.page_no != null && (
                                    <span className="text-xs font-mono text-slate-500 bg-black/30 px-2 py-0.5 rounded border border-white/5">
                                      Side {exc.page_no}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-600 font-mono">{exc.kind}</span>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                  {exc.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Claims tab */
          claims.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Ingen påstander ekstrahert. Last opp et dokument via Ingest.
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((c) => (
                <div
                  key={c.claim_id}
                  className="glass-panel p-5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-sm text-slate-200 leading-relaxed">{c.claim_text}</p>
                    <div className="flex flex-col gap-1 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono border ${
                          c.eclass === "E1"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : c.eclass === "E2"
                            ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                            : c.eclass === "E3"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {c.eclass}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Tag size={11} />
                      {claimTypeLabel[c.claim_type] ?? c.claim_type}
                    </span>
                    {c.stage && (
                      <span className="text-brand-400">{stageLabel[c.stage] ?? c.stage}</span>
                    )}
                    {c.claim_date && (
                      <span className="text-slate-500">
                        {new Date(c.claim_date).toLocaleDateString("nb-NO")}
                      </span>
                    )}
                    <span className="text-slate-600 ml-auto">{eclassLabel[c.eclass] ?? c.eclass}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin mr-3" /> Laster...
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
