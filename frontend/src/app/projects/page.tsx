"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Project[]>("/projects")
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Link href="/projects/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">New project</Link>
        </div>
        {loading && <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">Loading projects...</div>}
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>}
        {!loading && !error && projects.length === 0 && (
          <div className="rounded-md border border-border bg-white p-8 text-center text-sm text-muted">No projects yet. Create organization and project through API for MVP.</div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-md border border-border bg-white p-4 hover:border-brand">
              <div className="font-medium">{project.name}</div>
              <div className="mt-1 text-sm text-muted">{project.environment}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
