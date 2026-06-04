"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock3, Gauge, GitBranch, KeyRound, LayoutDashboard, Lightbulb, ListTree, Menu, Radio, Settings, Users, Wifi, X, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Project } from "@/types";

const nav = [
  ["Overview", LayoutDashboard, ""],
  ["Realtime", Radio, "realtime"],
  ["Web Analytics", BarChart3, "web-analytics"],
  ["Audience", Users, "audience"],
  ["Funnels", GitBranch, "funnels"],
  ["Performance", Gauge, "performance"],
  ["Insights", Lightbulb, "insights"],
  ["Events", ListTree, "events"],
  ["Sessions", Clock3, "sessions"],
  ["Monitors", Wifi, "monitors"],
  ["API Keys", KeyRound, "keys"],
  ["Settings", Settings, "settings"],
] as const;

export function AppShell({
  children,
  projectId,
  projectName,
  userName,
  projects: initialProjects = [],
}: {
  children: ReactNode;
  projectId?: string;
  projectName?: string;
  userName?: string;
  projects?: Project[];
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
    enabled: Boolean(projectId),
    initialData: initialProjects.length ? initialProjects : undefined,
    staleTime: 60_000,
  });
  const projects = projectsQuery.data ?? initialProjects;
  const projectFromList = projects.find((project) => project.id === projectId);
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiFetch<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId && !projectName && !projectFromList),
    staleTime: 60_000,
  });
  const displayProjectName = projectName ?? projectFromList?.name ?? projectQuery.data?.name;

  const activeLabel = useMemo(() => {
    if (!projectId) return "";
    const current = nav.find(([, , href]) => {
      const target = `/projects/${projectId}${href ? `/${href}` : ""}`;
      if (!href) {
        // overview should only be active on exact project root
        return pathname === target;
      }
      return pathname === target || pathname.startsWith(`${target}/`);
    });
    return current?.[0] ?? "";
  }, [pathname, projectId]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!projectMenuRef.current) return;
      if (!projectMenuRef.current.contains(e.target as Node)) setProjectMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-black/25 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface/95 p-4 shadow-[0_20px_70px_rgba(17,17,17,0.08)] backdrop-blur transition-transform md:w-64 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} flex flex-col h-full`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/projects" className="flex items-center gap-2 text-lg font-semibold">
            <Gauge className="h-5 w-5 text-brand" />
            Observa
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-full border border-border p-2 md:hidden" aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {projectId && (
          <div className="relative mb-5" ref={projectMenuRef}>
            <button
              type="button"
              onClick={() => setProjectMenuOpen((s) => !s)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-2 py-2 text-left shadow-sm transition hover:bg-surface-muted"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-ink text-xs font-bold text-white">
                {displayProjectName ? displayProjectName.charAt(0).toUpperCase() : projectId.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{displayProjectName ?? `Project ${projectId}`}</span>
              </span>
              <svg className={`h-4 w-4 shrink-0 transition ${projectMenuOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {projectMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                <div className="max-h-72 overflow-y-auto py-1.5">
                  {projects.length ? (
                    projects.map((project) => {
                      const isCurrent = project.id === projectId;

                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-muted ${isCurrent ? "text-ink" : "text-muted"}`}
                        >
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold ${isCurrent ? "bg-ink text-white" : "bg-surface-muted text-ink"}`}>
                            {project.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{project.name}</span>
                          {isCurrent && (
                            <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                            </svg>
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted">No projects found.</div>
                  )}
                </div>
                <div className="border-t border-border p-1.5">
                  <Link href="/projects/new" className="block rounded-md px-4 py-3 text-sm font-semibold hover:bg-surface-muted">
                    New Project
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {projectId &&
            nav.map(([label, Icon, href]) => {
              const target = `/projects/${projectId}${href ? `/${href}` : ""}`;
              const isActive = href === "" ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);

              return (
                <Link
                  key={label}
                  href={target}
                  onClick={() => {
                    setSidebarOpen(false);
                    setProjectMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-surface-muted"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
        </nav>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex w-full items-center gap-3 rounded-lg px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
              {(() => {
                const name = userName ?? "User";
                const parts = name.trim().split(" ").filter(Boolean);
                const initials = parts.length ? parts.map((p) => p[0].toUpperCase()).slice(0, 2).join("") : "U";
                return initials;
              })()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{userName ?? "User"}</span>
              <span className="block truncate text-xs text-muted">Workspace</span>
            </span>

            <button onClick={logout} aria-label="Log out" className="grid h-9 w-9 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-ink">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-canvas/80 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-full border border-border bg-surface p-2 md:hidden" aria-label="Open sidebar">
                <Menu className="h-4 w-4" />
              </button>
              <Link href="/projects" className="font-semibold md:hidden">
                Observa
              </Link>
            </div>
            <span className="hidden text-sm text-muted md:block">Self-hosted observability{activeLabel ? ` · ${activeLabel}` : ""}</span>
          </div>
        </header>
        <main className="min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
async function logout() {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/login";
}
