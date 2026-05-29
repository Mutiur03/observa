"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, AlertTriangle, Gauge, KeyRound, LayoutDashboard, ListTree, Settings, UserRound } from "lucide-react";

const nav = [
  ["Overview", LayoutDashboard, ""],
  ["Events", ListTree, "events"],
  ["Errors", AlertTriangle, "errors"],
  ["Requests", Activity, "requests"],
  ["Sessions", UserRound, "sessions"],
  ["API Keys", KeyRound, "keys"],
  ["Settings", Settings, "settings"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId?: string }>();
  const projectId = params.projectId;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white p-4 md:block">
        <Link href="/projects" className="mb-6 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="h-5 w-5 text-brand" />
          Observa
        </Link>
        <nav className="space-y-1">
          {projectId &&
            nav.map(([label, Icon, href]) => (
              <Link
                key={label}
                href={`/projects/${projectId}${href ? `/${href}` : ""}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-white px-5 py-3">
          <div className="flex items-center justify-between">
            <Link href="/projects" className="font-semibold md:hidden">Observa</Link>
            <span className="text-sm text-muted">Self-hosted observability</span>
          </div>
        </header>
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
