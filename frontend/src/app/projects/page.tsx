import Link from "next/link";
import { serverApiFetch } from "@/lib/server-api";
import type { Project } from "@/types";

export default async function ProjectsPage() {
  const projects = await serverApiFetch<Project[]>("/projects");

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border bg-surface/90 p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-2 text-sm text-muted">Pick a project or start a new one.</p>
          </div>
          <Link href="/projects/new" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-strong">New project</Link>
        </div>
        {projects.length === 0 && (
          <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
            <div className="font-medium">No projects yet</div>
            <p className="mt-2 text-sm text-muted">Create your first organization and project from the dashboard.</p>
            <Link href="/projects/new" className="mt-5 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Create project</Link>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-3xl border border-border bg-surface p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-brand">
              <div className="font-medium">{project.name}</div>
              <div className="mt-1 text-sm text-muted">{project.environment}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
