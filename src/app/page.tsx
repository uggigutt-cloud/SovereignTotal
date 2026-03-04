"use client";

import Link from "next/link";
import { MoveRight, Shield, BrainCircuit, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LandingPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/cases";

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-900/30 blur-[120px] rounded-full pointer-events-none" />

      <main className="z-10 text-center px-6 max-w-5xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-brand-500 font-medium text-sm mb-4">
            <BrainCircuit size={16} />
            <span>Powered by Google Vertex AI</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Sovereign<span className="text-brand-500">AI</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
            The Neural Core for absolute legal certainty. Transforming complex child welfare cases into deterministic, unassailable causality chains.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-8"
        >
          {session ? (
            <Link href="/cases" className="group relative px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-lg shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all flex items-center gap-2 overflow-hidden">
              <span className="relative z-10">Åpne Sovereign Portal</span>
              <MoveRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            </Link>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="group relative px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-lg shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all flex items-center gap-2 overflow-hidden"
            >
              <span className="relative z-10">Logg inn med Google</span>
              <MoveRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            </button>
          )}

          <Link href="/workbench" className="px-8 py-4 glass-panel text-slate-200 hover:text-white hover:bg-white/10 font-semibold rounded-lg transition-all flex items-center gap-2">
            <Activity size={18} />
            Launch Palantir Workbench
          </Link>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="grid md:grid-cols-3 gap-6 pt-16 text-left"
        >
          <div className="glass-panel p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded bg-brand-900/50 flex items-center justify-center text-brand-500 mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Deterministic Rules</h3>
            <p className="text-slate-400 text-sm">Every procedural error is hashed, tracked, and propagated through the timeline without fail.</p>
          </div>

          <div className="glass-panel p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded bg-brand-900/50 flex items-center justify-center text-brand-500 mb-4">
              <Activity size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Causality Chains</h3>
            <p className="text-slate-400 text-sm">Visualize exactly how early errors infect final judgments across the entire case geometry.</p>
          </div>

          <div className="glass-panel p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded bg-brand-900/50 flex items-center justify-center text-brand-500 mb-4">
              <BrainCircuit size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Gemini Data Ingest</h3>
            <p className="text-slate-400 text-sm">Drop a PDF and watch Vertex AI instantly construct the topological lattice for your workbench.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
