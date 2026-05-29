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
    <form onSubmit={save} className="max-w-2xl rounded-md border border-border bg-surface p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">Project name<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value })} /></label>
        <label className="block text-sm font-medium">Project slug<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.slug} onChange={(event) => setProject({ ...project, slug: event.target.value })} /></label>
        <label className="block text-sm font-medium">Environment<select className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.environment} onChange={(event) => setProject({ ...project, environment: event.target.value })}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
      </div>
      {message && <p className="mt-4 rounded-md border border-success/20 bg-success-soft p-3 text-sm text-success">{message}</p>}
      {error && <p className="mt-4 rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Save changes</button>
    </form>
  );
}
