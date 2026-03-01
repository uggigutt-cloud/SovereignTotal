"use client";

import { Link2, Search, Filter, FileCheck, FileX, AlertTriangle } from "lucide-react";

export default function EvidenceChain() {
    const evidence = [
        { id: "D-01", title: "Bekymringsmelding", date: "12.01.2026", type: "Offentlig", status: "ok" },
        { id: "D-04", title: "Referat Samtale (Skole)", date: "15.01.2026", type: "Notat", status: "defect", rule: "R-DOK-02", note: "Mangler signatur og kontradiksjon" },
        { id: "D-09", title: "Akuttvedtak BVT", date: "28.01.2026", type: "Vedtak", status: "infected", source: "D-04", note: "Bygger på ulovlig innhentet/udokumentert bevis i D-04" },
        { id: "D-12", title: "Sakkyndig Rapport", date: "10.02.2026", type: "Sakkyndig", status: "ok" },
    ];

    return (
        <div className="h-full overflow-y-auto bg-dark-900 text-slate-200 p-8 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Link2 size={28} className="text-emerald-500" />
                            Beviskjede (Evidence Chain)
                        </h1>
                        <p className="text-slate-400 mt-2">Analyse av dokumentarisk bevisførelse og lovlighet (Fruit of the Poisonous Tree)</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/5">
                            <Search size={14} className="text-slate-500" />
                            <input type="text" placeholder="Søk bevis..." className="bg-transparent border-none outline-none text-xs w-48 text-white" />
                        </div>
                        <button className="p-1.5 rounded hover:bg-white/10 text-slate-400 border border-white/10">
                            <Filter size={16} />
                        </button>
                    </div>
                </div>

                {/* Evidence List */}
                <div className="glass-panel rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-slate-400 text-xs uppercase font-mono tracking-wider">
                            <tr>
                                <th className="px-6 py-4">ID / Dato</th>
                                <th className="px-6 py-4">Dokument / Type</th>
                                <th className="px-6 py-4">Legalitet / Status</th>
                                <th className="px-6 py-4 text-right">Handling</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {evidence.map((item) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-brand-400">{item.id}</div>
                                        <div className="text-xs text-slate-500">{item.date}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white">{item.title}</div>
                                        <div className="text-xs text-slate-500 bg-black/40 inline-block px-2 py-0.5 rounded mt-1 border border-white/5">{item.type}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.status === 'ok' && (
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <FileCheck size={16} /> <span className="text-xs font-bold">LEGITIMT</span>
                                            </div>
                                        )}
                                        {item.status === 'defect' && (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-rose-400">
                                                    <FileX size={16} /> <span className="text-xs font-bold">BEVISFEIL</span>
                                                </div>
                                                <div className="text-xs font-mono text-rose-500/80">{item.rule}</div>
                                                <div className="text-[10px] text-slate-400 max-w-[200px] leading-tight mt-1">{item.note}</div>
                                            </div>
                                        )}
                                        {item.status === 'infected' && (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-amber-400">
                                                    <AlertTriangle size={16} /> <span className="text-xs font-bold">INFISERT BEVIS</span>
                                                </div>
                                                <div className="text-xs font-mono text-amber-500/80">KILDE: {item.source}</div>
                                                <div className="text-[10px] text-slate-400 max-w-[200px] leading-tight mt-1">{item.note}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-brand-400 hover:text-white text-xs font-mono bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                                            ÅPNE I KAUSALITET
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
