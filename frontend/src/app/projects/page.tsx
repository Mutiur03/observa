import Link from "next/link";
import { serverApiFetch } from "@/lib/server-api";
import type { Project } from "@/types";

export default async function ProjectsPage() {
  const projects = await serverApiFetch<Project[]>("/projects");

  return (
    <main className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Link href="/projects/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">New project</Link>
        </div>
        {projects.length === 0 && (
          <div className="rounded-md border border-border bg-surface p-8 text-center">
            <div className="font-medium">No projects yet</div>
            <p className="mt-2 text-sm text-muted">Create your first organization and project from the dashboard.</p>
            <Link href="/projects/new" className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Create project</Link>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-md border border-border bg-surface p-4 hover:border-brand">
              <div className="font-medium">{project.name}</div>
              <div className="mt-1 text-sm text-muted">{project.environment}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
