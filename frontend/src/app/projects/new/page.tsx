"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState({ name: "", slug: "" });
  const [project, setProject] = useState({ name: "", slug: "", environment: "production" });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const org = await apiFetch<{ id: string }>("/organizations", { method: "POST", body: JSON.stringify(organization) });
      const created = await apiFetch<{ id: string }>("/projects", {
        method: "POST",
        body: JSON.stringify({ ...project, organization_id: org.id }),
      });
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-6">
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-md border border-border bg-white p-6">
        <h1 className="text-xl font-semibold">New project</h1>
        <input className="mt-5 w-full rounded-md border border-border px-3 py-2" placeholder="Organization name" value={organization.name} onChange={(e) => setOrganization({ ...organization, name: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-border px-3 py-2" placeholder="Organization slug" value={organization.slug} onChange={(e) => setOrganization({ ...organization, slug: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-border px-3 py-2" placeholder="Project name" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
        <input className="mt-3 w-full rounded-md border border-border px-3 py-2" placeholder="Project slug" value={project.slug} onChange={(e) => setProject({ ...project, slug: e.target.value })} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Create</button>
      </form>
    </main>
  );
}
