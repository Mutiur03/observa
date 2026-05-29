"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";

export type AlertRuleRow = { id: string; name: string; rule_type: string; threshold?: number; window_seconds?: number; is_active: boolean };

export function AlertsPanel({ projectId, initialRows }: { projectId: string; initialRows: AlertRuleRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState({ name: "", rule_type: "error_threshold", threshold: 10 });
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const created = await apiFetch<AlertRuleRow>("/alerts", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, name: form.name, rule_type: form.rule_type, threshold: Number(form.threshold), window_seconds: 300, is_active: true }),
      });
      setRows((current) => [created, ...current]);
      setForm({ name: "", rule_type: "error_threshold", threshold: 10 });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function deleteRule(id: string) {
    await apiFetch(`/alerts/${id}`, { method: "DELETE" });
    setRows((current) => current.filter((row) => row.id !== id));
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Alerts</h1>
      <form onSubmit={create} className="mb-5 grid gap-3 rounded-md border border-border bg-surface p-4 md:grid-cols-[1fr_220px_120px_auto]">
        <input className="rounded-md border border-border px-3 py-2 text-sm" placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="rounded-md border border-border px-3 py-2 text-sm" value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
          <option value="error_threshold">Error threshold</option><option value="monitor_down">Monitor down</option><option value="slow_endpoint">Slow endpoint</option><option value="failed_job">Failed job</option><option value="failed_webhook">Failed webhook</option>
        </select>
        <input className="rounded-md border border-border px-3 py-2 text-sm" type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">Create</button>
      </form>
      {error && <div className="mb-4 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
      <DataTable rows={rows} empty="No alert rules yet." columns={[
        { key: "name", label: "Name", render: (row) => row.name },
        { key: "type", label: "Type", render: (row) => row.rule_type },
        { key: "threshold", label: "Threshold", render: (row) => row.threshold ?? "-" },
        { key: "active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" },
        { key: "action", label: "", render: (row) => <button className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => deleteRule(row.id)}>Delete</button> },
      ]} />
    </>
  );
}
