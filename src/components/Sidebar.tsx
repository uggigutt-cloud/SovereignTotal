"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Network, FolderPlus, Settings, ShieldAlert, ChevronLeft, ChevronRight, Menu, UserSquare2, Link2 } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const navItems = [
        { name: "Mine Saker", href: "/cases", icon: FolderPlus },
        { name: "Ny Sak / Opplastning", href: "/ingest", icon: FolderPlus },
        { name: "Saksprofil", href: "/profile", icon: UserSquare2 },
        { name: "Nexus Tidslinje", href: "/portal", icon: LayoutDashboard },
        { name: "Kausalitetskjede", href: "/workbench", icon: Network },
        { name: "Beviskjede", href: "/evidence", icon: Link2 },
        { name: "Innstillinger", href: "/settings", icon: Settings },
    ];

    return (
        <div className={`h-screen bg-dark-900 border-r border-white/10 flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"} shrink-0`}>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={18} className="text-brand-500" />
                        <span className="font-bold text-white text-sm tracking-wide">SovereignAI</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`p-1.5 rounded hover:bg-white/10 text-slate-400 transition-colors ${collapsed ? "mx-auto" : ""}`}
                >
                    {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive
                                ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                                } ${collapsed ? "justify-center px-0" : ""}`}
                            title={collapsed ? item.name : undefined}
                        >
                            <Icon size={18} />
                            {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
                        </Link>
                    );
                })}
            </div>

            {/* Footer User Info */}
            <div className="p-4 border-t border-white/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <span className="text-xs font-bold text-indigo-400">FR</span>
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white truncate">Freddy R.</div>
                        <div className="text-[10px] text-slate-500 truncate">Administrator</div>
                    </div>
                )}
            </div>
        </div>
    );
}
