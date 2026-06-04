"use client";

import { useState } from "react";
import type { Project } from "@/types";
import { apiFetch } from "@/lib/api";

export function ProjectSettingsForm({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState(initialProject);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const updated = await apiFetch<Project>(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: project.name, slug: project.slug, environment: project.environment }),
      });
      setProject(updated);
      setMessage("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Project identity</p>
        <h2 className="mt-2 text-xl font-semibold">{project.name}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Project ID</dt>
            <dd className="mt-1 break-all font-medium text-ink">{project.id}</dd>
          </div>
          <div>
            <dt className="text-muted">Organization</dt>
            <dd className="mt-1 break-all font-medium text-ink">{project.organization_id}</dd>
          </div>
          <div>
            <dt className="text-muted">Environment</dt>
            <dd className="mt-1 font-medium text-ink">{project.environment}</dd>
          </div>
        </dl>
      </div>
      <form onSubmit={save} className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Editable settings</h2>
          <p className="mt-1 text-sm text-muted">Update the project name, URL slug, and deployment environment label.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">Project name<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value })} /></label>
          <label className="block text-sm font-medium">Project slug<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.slug} onChange={(event) => setProject({ ...project, slug: event.target.value })} /></label>
          <label className="block text-sm font-medium">Environment<select className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.environment} onChange={(event) => setProject({ ...project, environment: event.target.value })}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
        </div>
        {message && <p className="mt-4 rounded-md border border-success/20 bg-success-soft p-3 text-sm text-success">{message}</p>}
        {error && <p className="mt-4 rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <button className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Save changes</button>
      </form>
    </div>
  );
}
