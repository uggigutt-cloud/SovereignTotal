import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen w-full bg-dark-950 overflow-hidden text-slate-200">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {children}
            </div>
        </div>
    );
}
