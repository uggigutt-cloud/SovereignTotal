"use client";

import { CheckCircle2, AlertTriangle, XCircle, Activity, FileText } from "lucide-react";

export default function SovereignPortal() {
    return (
        <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
            <header className="max-w-6xl mx-auto flex items-center justify-between mb-12 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            Sovereign<span className="text-brand-500">Portal</span>
                        </h1>
                        <p className="text-sm text-slate-500">Case Overview: B-2026-441-A</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-3">
                        <span className="text-sm text-slate-400">Health Score</span>
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <Activity size={16} /> 78%
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-xl space-y-4">
                        <h3 className="font-semibold text-white border-b border-white/10 pb-2">Case Summary</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            This case is currently evaluated with a strong defensive perimeter. The Sovereign Engine has detected <span className="text-rose-400 font-medium">3 procedural defects</span> in Stage A (Investigation) that cascade and infect the validity of the current emergency resolution (Stage C).
                        </p>

                        <div className="pt-4 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                <span>Jurisdiction Confirmed</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <AlertTriangle size={16} className="text-amber-500" />
                                <span>Notice Period Violated (42 hours late)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <XCircle size={16} className="text-rose-500" />
                                <span>Lack of Objective Substantiation (EMD Art 8)</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-xl space-y-4">
                        <h3 className="font-semibold text-white border-b border-white/10 pb-2">Documents</h3>
                        <div className="space-y-2">
                            {[1, 2, 3].map((doc) => (
                                <div key={doc} className="flex items-center gap-3 p-3 rounded-lg bg-black/20 hover:bg-black/40 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                                    <FileText size={16} className="text-brand-500" />
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-300">Vedtak_{doc}_2026.pdf</p>
                                        <p className="text-xs text-slate-500">Processed by Neural Core</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Nexus Stream */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6 rounded-xl">
                        <h2 className="text-xl font-bold text-white mb-6">The Nexus Stream</h2>

                        <div className="relative border-l-2 border-slate-800 ml-4 space-y-8 pb-4">

                            {/* Timeline Item 1 */}
                            <div className="relative pl-6">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-dark-900" />
                                <div className="mb-1 text-xs text-slate-500 font-mono">12. Jan 2026 - STAGE A</div>
                                <h4 className="text-md font-semibold text-slate-200">Undersøkelse opprettet</h4>
                                <p className="text-sm text-slate-400 mt-1">Barneverntjenesten mottar bekymringsmelding og beslutter opprettelse av undersøkelsessak ihht loven.</p>
                            </div>

                            {/* Timeline Item 2 (Defect) */}
                            <div className="relative pl-6">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-rose-500 ring-4 ring-dark-900" />
                                <div className="mb-1 text-xs text-rose-500/80 font-mono">28. Jan 2026 - DEFECT DETECTED</div>
                                <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                    <h4 className="text-md font-semibold text-rose-400">Manglende Kontradiksjon (EMD Art 6 & 8)</h4>
                                    <p className="text-sm text-slate-300 mt-2">
                                        Partene ble ikke gitt anledning til å uttale seg om de fremlagte bevisene før vedtak om akuttvedtak ble truffet. Dette utgjør en saksbehandlingsfeil.
                                    </p>
                                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/30 text-xs font-mono text-rose-300 border border-rose-500/20">
                                        RULE: R-KONTRA-01
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Item 3 (Infected) */}
                            <div className="relative pl-6">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_#f59e0b] ring-4 ring-dark-900" />
                                <div className="mb-1 text-xs text-amber-500/80 font-mono">03. Feb 2026 - STAGE C (INFECTED)</div>
                                <h4 className="text-md font-semibold text-amber-400">Akuttvedtak fattes (§ 4-2)</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    Vedtaket bygger direkte på bevisgrunnlaget fra Stage A. På grunn av saksbehandlingsfeilen er kausalitetskjeden nå brutt (&quot;Causality Chain of Invalidity&quot;). Vedtaket vurderes som sterkt angripelig.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
