"use client";

import { Network, Bot, Send, Search, Filter, ShieldAlert } from "lucide-react";
import { useState } from "react";

export default function PalantirWorkbench() {
    const [chatMessage, setChatMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatLog, setChatLog] = useState<{ role: string, text: string }[]>([
        { role: "agent", text: "Sovereign Neural Core online. The causality chain for the active case is loaded. Ask me to draft cross-examination questions or analyze specific defects." }
    ]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMessage.trim() || isLoading) return;

        const userText = chatMessage;
        setChatLog(prev => [...prev, { role: "user", text: userText }]);
        setChatMessage("");
        setIsLoading(true);

        try {
            // We pass a dummy caseId for now until Phase 9 (Case Selection) is done, 
            // but the API will still try to pull from Postgres if it exists.
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    caseId: 'B-2026-441-A', // Default mock case ID
                    history: chatLog.map(m => ({ role: m.role, content: m.text }))
                })
            });

            const data = await response.json();

            if (data.reply) {
                setChatLog(prev => [...prev, { role: "agent", text: data.reply }]);
            } else {
                setChatLog(prev => [...prev, { role: "agent", text: "⚠️ Systemfeil: " + (data.error || "Kunne ikke nå Neural Core.") }]);
            }
        } catch (error) {
            setChatLog(prev => [...prev, { role: "agent", text: "⚠️ Nettverksfeil: Klarte ikke kontakte serveren." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-dark-900 text-slate-200 font-sans overflow-hidden">

            {/* Top Navigation Bar */}
            <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-dark-800 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-brand-500 font-bold bg-brand-900/40 px-3 py-1 rounded border border-brand-500/20">
                        <Network size={16} />
                        Sovereign Workbench
                    </div>
                    <span className="text-xs font-mono text-slate-500">SESSION: 0x9F4A2</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-black/40 border border-white/5">
                        <Search size={14} className="text-slate-500" />
                        <input type="text" placeholder="Search nodes..." className="bg-transparent border-none outline-none text-xs w-48 text-white placeholder:text-slate-600" />
                    </div>
                    <button title="Filter nodes" className="p-1.5 rounded hover:bg-white/10 text-slate-400">
                        <Filter size={16} />
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Pane: Topological Lattice (Graph) & Thematic Overlays */}
                <div className="flex-1 relative bg-[#0b0c10] overflow-hidden flex flex-col">

                    {/* Thematic Dashboard Cards (Floating Top Left) */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
                        <div className="glass-panel w-72 p-4 rounded-xl border border-white/5 bg-dark-900/60 backdrop-blur-md">
                            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">Defect Summary Panel</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-rose-400 flex items-center gap-2"><ShieldAlert size={14} /> Procedural</span>
                                    <span className="font-bold text-white">3</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-amber-400 flex items-center gap-2"><ShieldAlert size={14} /> Material</span>
                                    <span className="font-bold text-white">1</span>
                                </div>
                                <div className="h-1.5 w-full bg-dark-950 rounded-full mt-2 flex overflow-hidden">
                                    <div className="h-full bg-rose-500 w-[75%]"></div>
                                    <div className="h-full bg-amber-500 w-[25%]"></div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel w-72 p-4 rounded-xl border border-white/5 bg-dark-900/60 backdrop-blur-md">
                            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">Jurisdiction Analysis</h3>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                    <span className="text-emerald-500 font-bold">OK</span>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white">Local Authority Confirmed</div>
                                    <div className="text-[10px] text-slate-500">§ 1-2 Child Welfare Act</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulated Graph Grid Background */}
                    <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:30px_30px] opacity-30" />

                    {/* Simulated Graph Elements */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center">

                        {/* Infection Path Simulation */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <path d="M 300 300 C 400 300, 450 450, 600 450" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 4" className="animate-pulse" />
                            <path d="M 600 450 C 700 450, 750 300, 900 300" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />
                        </svg>

                        <div className="absolute top-[280px] left-[250px] glass-panel p-3 rounded-lg border-rose-500/50 w-48 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                            <div className="text-[10px] font-mono text-rose-400 mb-1 flex items-center gap-1"><ShieldAlert size={10} /> DEFECT ORIGIN</div>
                            <div className="text-sm font-bold text-white">Stage A: Undersøkelse</div>
                        </div>

                        <div className="absolute top-[430px] left-[550px] glass-panel p-3 rounded-lg border-amber-500/50 w-48 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <div className="text-[10px] font-mono text-amber-400 mb-1">INFECTED NODE</div>
                            <div className="text-sm font-bold text-white">Stage C: Akuttvedtak</div>
                        </div>

                        <div className="absolute top-[280px] left-[850px] glass-panel p-3 rounded-lg border-slate-700 w-48">
                            <div className="text-[10px] font-mono text-slate-400 mb-1">TARGET NODE</div>
                            <div className="text-sm font-bold text-slate-300">Stage G: Tingrett</div>
                        </div>

                    </div>

                    <div className="absolute bottom-4 left-4 glass-panel px-3 py-2 rounded text-xs text-slate-400 font-mono">
                        View: Topological Lattice | Scope: Global Causal Links
                    </div>
                </div>

                {/* Right Pane: The Action Forge (Vertex AI Chat) */}
                <div className="w-[400px] border-l border-white/10 bg-dark-800 flex flex-col shrink-0">
                    <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-dark-900/50">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 border border-brand-500/30">
                            <Bot size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-white">The Action Forge</h3>
                            <p className="text-[10px] text-brand-400 font-mono uppercase">Neural Core Linked</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm leading-relaxed">
                        {chatLog.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[90%] ${msg.role === 'user' ? 'bg-brand-600 text-white shadow-md' : 'bg-white/5 text-slate-300 border border-white/10'}`}>
                                    {msg.text.split('\n').map((line, j) => (
                                        <span key={j}>{line}<br /></span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex flex-col items-start">
                                <div className="p-3 rounded-xl bg-white/5 text-slate-400 border border-white/10 italic text-xs animate-pulse">
                                    Neural Core analyserer...
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
                                placeholder={isLoading ? "Venter på svar..." : "Command Vertex AI..."}
                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                title="Send message"
                                disabled={!chatMessage.trim() || isLoading}
                                className="absolute right-2 p-1.5 rounded-md text-brand-500 hover:bg-brand-500/20 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
}
