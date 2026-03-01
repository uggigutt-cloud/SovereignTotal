"use client";

import { UserSquare2, Scale, Calendar, FileText, AlertTriangle, ShieldCheck } from "lucide-react";

export default function CaseProfile() {
    return (
        <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-brand-500/20 flex flex-col items-center justify-center border border-brand-500/30">
                            <UserSquare2 size={24} className="text-brand-400 mb-1" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                Saksprofil <span className="text-sm font-mono text-brand-500 bg-brand-500/10 px-2 py-1 rounded">B-2026-441-A</span>
                            </h1>
                            <p className="text-slate-400 mt-1">Sist oppdatert av Neural Core: 2 minutter siden</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="glass-panel px-4 py-2 rounded-lg border-emerald-500/30 bg-emerald-500/5">
                            <span className="text-xs text-emerald-500 font-mono block mb-1 uppercase tracking-widest">Aktiv Fase</span>
                            <span className="font-bold text-white">Stage D: Fylkesnemnd</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Party Information */}
                    <div className="glass-panel p-6 rounded-xl col-span-2 space-y-6">
                        <h3 className="font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                            <Scale size={18} className="text-slate-400" /> Parter & Aktører
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Privat Part (Mor)</div>
                                <div className="font-bold text-white text-lg">Kari Nordmann</div>
                                <div className="text-sm text-slate-400 mt-2">Advokat: Adv. Firma Rettferdighet AS</div>
                            </div>

                            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Offentlig Part</div>
                                <div className="font-bold text-white text-lg">Oslo Kommune (BVT)</div>
                                <div className="text-sm text-slate-400 mt-2">Kommuneadvokaten v/ P. Holm</div>
                            </div>

                            <div className="bg-black/20 p-4 rounded-lg border border-white/5 col-span-2 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Hovedtema</div>
                                    <div className="font-bold text-white">Omsorgsovertakelse (§ 4-12)</div>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs rounded border border-rose-500/20">Akuttvedtak Fattet</span>
                                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/20">EMD Art 8 Påberopt</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Timeline Summary */}
                    <div className="glass-panel p-6 rounded-xl space-y-6">
                        <h3 className="font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                            <Calendar size={18} className="text-slate-400" /> Nøkkeltall
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                <span className="text-slate-400 flex items-center gap-2"><FileText size={16} /> Dokumenter</span>
                                <span className="font-bold text-white text-lg">42</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                <span className="text-slate-400 flex items-center gap-2"><AlertTriangle size={16} /> S-Feil (Defects)</span>
                                <span className="font-bold text-rose-400 text-lg">4</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 flex items-center gap-2"><ShieldCheck size={16} /> Prosessuelt Helhet</span>
                                <span className="font-bold text-amber-400 text-lg">Angripelig</span>
                            </div>
                        </div>

                        <button className="w-full py-2 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 rounded-lg border border-brand-500/30 transition-colors text-sm font-bold">
                            Generer Saksresyme (AI)
                        </button>
                    </div>

                </div>

                {/* Action Prompt */}
                <div className="glass-panel p-6 rounded-xl text-center bg-gradient-to-r from-brand-900/10 to-transparent border-l-4 border-l-brand-500">
                    <h3 className="text-lg font-bold text-white mb-2">Saksbehandlingen er klar for analyse</h3>
                    <p className="text-slate-400 text-sm max-w-2xl mx-auto mb-4">
                        Neural Core har indeksert alle dokumenter. Gå til <strong>Saksoversikt</strong> for tidslinjen, eller <strong>Kausalitetskjede</strong> for å avdekke skjulte logiske brister i saken.
                    </p>
                </div>

            </div>
        </div>
    );
}
