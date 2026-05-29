"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";

export type MonitorRow = { id: string; name: string; url: string; method: string; expected_status: number; interval_seconds: number; is_active: boolean };

export function MonitorsPanel({ projectId, initialRows }: { projectId: string; initialRows: MonitorRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState({ name: "", url: "", expected_status: 200 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const monitor = await apiFetch<MonitorRow>("/monitors", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, name: form.name, url: form.url, method: "GET", expected_status: Number(form.expected_status), interval_seconds: 60, timeout_seconds: 5, is_active: true }),
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Create failed");
      return null;
    });
    if (!monitor) return;
    setRows((current) => [monitor, ...current]);
    setForm({ name: "", url: "", expected_status: 200 });
    router.refresh();
  }

  async function checkNow(id: string) {
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ is_success: boolean; status_code?: number; response_time_ms?: number }>(`/monitors/${id}/check`, { method: "POST" });
      setMessage(`Check ${result.is_success ? "passed" : "failed"}${result.status_code ? ` with ${result.status_code}` : ""}${result.response_time_ms ? ` in ${result.response_time_ms}ms` : ""}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    }
  }

  async function deleteMonitor(id: string) {
    await apiFetch(`/monitors/${id}`, { method: "DELETE" });
    setRows((current) => current.filter((row) => row.id !== id));
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Monitors</h1>
      <form onSubmit={create} className="mb-5 grid gap-3 rounded-md border border-border bg-surface p-4 md:grid-cols-[1fr_2fr_120px_auto]">
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="https://api.example.com/health" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="rounded-md border border-border px-3 py-2 text-sm" type="number" value={form.expected_status} onChange={(e) => setForm({ ...form, expected_status: Number(e.target.value) })} />
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Create</button>
      </form>
      {message && <div className="mb-4 rounded-md border border-success/20 bg-success-soft p-4 text-sm text-success">{message}</div>}
      {error && <div className="mb-4 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
      <DataTable rows={rows} empty="No monitors yet." columns={[
        { key: "name", label: "Name", render: (row) => row.name },
        { key: "url", label: "URL", render: (row) => row.url },
        { key: "status", label: "Expected", render: (row) => row.expected_status },
        { key: "active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" },
        { key: "action", label: "", render: (row) => <div className="flex gap-2"><button className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => checkNow(row.id)}>Check</button><button className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => deleteMonitor(row.id)}>Delete</button></div> },
      ]} />
    </>
  );
}
