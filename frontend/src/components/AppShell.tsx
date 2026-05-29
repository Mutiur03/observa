"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Bell, Gauge, KeyRound, LayoutDashboard, ListTree, Settings, UserRound, Wifi } from "lucide-react";
import { apiFetch } from "@/lib/api";

const nav = [
  ["Overview", LayoutDashboard, ""],
  ["Events", ListTree, "events"],
  ["Errors", AlertTriangle, "errors"],
  ["Requests", Activity, "requests"],
  ["Sessions", UserRound, "sessions"],
  ["Monitors", Wifi, "monitors"],
  ["Alerts", Bell, "alerts"],
  ["API Keys", KeyRound, "keys"],
  ["Settings", Settings, "settings"],
] as const;

export function AppShell({ children, projectId }: { children: React.ReactNode; projectId?: string }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface p-4 md:block">
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
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink hover:bg-surface-muted"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-surface px-5 py-3">
          <div className="flex items-center justify-between">
            <Link href="/projects" className="font-semibold md:hidden">Observa</Link>
            <span className="text-sm text-muted">Self-hosted observability</span>
            <button onClick={logout} className="rounded-md border border-border px-3 py-1.5 text-sm">Logout</button>
          </div>
        </header>
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }
