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
    <form onSubmit={submit} className="mx-auto max-w-2xl rounded-md border border-border bg-surface p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create project</h1>
        <button type="button" onClick={() => router.push("/projects")} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-1">
        <button type="button" disabled={!organizations.length} onClick={() => setMode("existing")} className={`rounded px-3 py-2 text-sm ${mode === "existing" ? "bg-surface text-ink shadow-sm" : "text-muted"} disabled:opacity-50`}>Existing organization</button>
        <button type="button" onClick={() => setMode("new")} className={`rounded px-3 py-2 text-sm ${mode === "new" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>New organization</button>
      </div>
      {mode === "existing" ? (
        <label className="block text-sm font-medium">
          Organization
          <select className="mt-1 w-full rounded-md border border-border px-3 py-2" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">Organization name<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value, slug: slugify(event.target.value) })} /></label>
          <label className="block text-sm font-medium">Organization slug<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={orgSlug} onChange={(event) => setOrganization({ ...organization, slug: slugify(event.target.value) })} /></label>
        </div>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium">Project name<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value, slug: slugify(event.target.value) })} /></label>
        <label className="block text-sm font-medium">Project slug<input className="mt-1 w-full rounded-md border border-border px-3 py-2" value={projectSlug} onChange={(event) => setProject({ ...project, slug: slugify(event.target.value) })} /></label>
        <label className="block text-sm font-medium">Environment<select className="mt-1 w-full rounded-md border border-border px-3 py-2" value={project.environment} onChange={(event) => setProject({ ...project, environment: event.target.value })}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
      </div>
      {error && <p className="mt-4 rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button disabled={loading} className="mt-6 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60">{loading ? "Creating..." : "Create project"}</button>
    </form>
  );
}
