"use client";

import Link from "next/link";
import { FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function CasesDashboard() {
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/cases')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.cases.length > 0) {
                    setCases(data.cases);
                } else {
                    // Start with an empty array if nothing is in the db
                    setCases([]);
                }
            })
            .catch(() => {
                setCases([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleDeleteCase = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // Prevent navigating to the case profile
        if (!confirm(`Er du sikker på at du vil slette sak ${id}? Dette kan ikke angres.`)) return;

        try {
            const res = await fetch(`/api/cases?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setCases(prev => prev.filter(c => c.id !== id));
            } else {
                alert('Feil ved sletting: ' + data.error);
            }
        } catch (error) {
            alert('En nettverksfeil oppstod under sletting.');
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
            <header className="max-w-6xl mx-auto flex items-center justify-between mb-8 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        Sovereign<span className="text-brand-500">Saksoversikt</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Administrer og naviger mellom aktive saksmapper</p>
                </div>

                <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/5">
                        <Search size={14} className="text-slate-500" />
                        <input type="text" placeholder="Søk etter sak..." className="bg-transparent border-none outline-none text-xs w-48 text-white placeholder:text-slate-600" />
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add New Case Card */}
                    <Link href="/ingest" className="group glass-panel p-6 rounded-xl border border-white/5 hover:border-brand-500/50 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[160px] bg-dark-900/40">
                        <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                        </div>
                        <span className="font-bold text-slate-300 group-hover:text-brand-400">Opprett Ny Sak & Laste opp dokumenter</span>
                    </Link>

                    {loading ? (
                        <div className="glass-panel p-6 rounded-xl border border-white/5 animate-pulse min-h-[160px] flex items-center justify-center text-sm text-slate-500">
                            Laster inn saker fra databasen...
                        </div>
                    ) : (
                        cases.map((c) => (
                            <Link href={`/portal?caseId=${encodeURIComponent(c.id)}`} key={c.id} className="group glass-panel p-6 rounded-xl border border-white/5 hover:border-brand-500/50 transition-all cursor-pointer min-h-[160px] flex flex-col justify-between relative overflow-hidden">

                                {/* Background glow on hover */}
                                <div className="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="relative z-10 flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 font-mono text-xs border border-brand-500/30">
                                            <FolderOpen size={16} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white group-hover:text-brand-400 transition-colors uppercase tracking-wider">{c.id}</h3>
                                            <p className="text-xs text-slate-400 mt-1">{c.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteCase(e, c.id)}
                                        className="p-2 -mr-2 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-all z-20"
                                        title="Slett sak"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="relative z-10 flex justify-between items-center text-xs border-t border-white/5 pt-3">
                                    <span className="text-slate-500">Sist oppdatert:</span>
                                    <span className="text-slate-300 font-mono">
                                        {new Date(c.lastActive).toLocaleDateString('no-NO')}
                                    </span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
