"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Organization } from "@/types";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function NewProjectForm({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "new">(organizations.length ? "existing" : "new");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [organization, setOrganization] = useState({ name: "", slug: "" });
  const [project, setProject] = useState({ name: "", slug: "", environment: "production" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const orgSlug = useMemo(() => organization.slug || slugify(organization.name), [organization]);
  const projectSlug = useMemo(() => project.slug || slugify(project.name), [project]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      let targetOrganizationId = organizationId;
      if (mode === "new") {
        const org = await apiFetch<{ id: string }>("/organizations", {
          method: "POST",
          body: JSON.stringify({ name: organization.name, slug: orgSlug }),
        });
        targetOrganizationId = org.id;
      }
      const created = await apiFetch<{ id: string }>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: project.name,
          slug: projectSlug,
          environment: project.environment,
          organization_id: targetOrganizationId,
        }),
      });
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl border border-border bg-surface/95 p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create project</h1>
        </div>
        <button type="button" onClick={() => router.push("/projects")} className="rounded-full border border-border bg-surface px-3 py-2 text-sm">Cancel</button>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-1">
        <button type="button" disabled={!organizations.length} onClick={() => setMode("existing")} className={`rounded-2xl px-3 py-2 text-sm ${mode === "existing" ? "bg-surface text-ink shadow-sm" : "text-muted"} disabled:opacity-50`}>Existing organization</button>
        <button type="button" onClick={() => setMode("new")} className={`rounded-2xl px-3 py-2 text-sm ${mode === "new" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>New organization</button>
      </div>
      {mode === "existing" ? (
        <label className="block text-sm font-medium">
          Organization
          <select className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">Organization name<input className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value, slug: slugify(event.target.value) })} /></label>
          <label className="block text-sm font-medium">Organization slug<input className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={orgSlug} onChange={(event) => setOrganization({ ...organization, slug: slugify(event.target.value) })} /></label>
        </div>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium">Project name<input className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value, slug: slugify(event.target.value) })} /></label>
        <label className="block text-sm font-medium">Project slug<input className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={projectSlug} onChange={(event) => setProject({ ...project, slug: slugify(event.target.value) })} /></label>
        <label className="block text-sm font-medium">Environment<select className="mt-1 w-full rounded-2xl border border-border bg-surface px-3 py-2 outline-none focus:border-brand" value={project.environment} onChange={(event) => setProject({ ...project, environment: event.target.value })}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button disabled={loading} className="mt-6 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">{loading ? "Creating..." : "Create project"}</button>
    </form>
  );
}
