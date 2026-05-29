"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";

export type ApiKeyRow = { id: string; name: string; key_prefix: string; key_type: string; is_active: boolean; key?: string };

export function ApiKeysPanel({ projectId, initialKeys }: { projectId: string; initialKeys: ApiKeyRow[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [createdKey, setCreatedKey] = useState("");
  const [keyName, setKeyName] = useState("Browser SDK key");
  const [error, setError] = useState("");

  async function createKey(key_type: "public" | "secret") {
    setError("");
    try {
      const key = await apiFetch<ApiKeyRow>(`/projects/${projectId}/api-keys`, {
        method: "POST",
        body: JSON.stringify({ name: keyName || `${key_type} key`, key_type }),
      });
      setCreatedKey(key.key ?? "");
      setKeys((current) => [key, ...current]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function revokeKey(id: string) {
    await apiFetch(`/projects/${projectId}/api-keys/${id}`, { method: "DELETE" });
    setKeys((current) => current.map((key) => key.id === id ? { ...key, is_active: false } : key));
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="rounded-md border border-border px-3 py-2 text-sm" value={keyName} onChange={(event) => setKeyName(event.target.value)} />
          <button onClick={() => createKey("public")} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted">Public key</button>
          <button onClick={() => createKey("secret")} className="rounded-md bg-brand px-3 py-2 text-sm text-white hover:bg-brand-strong">Secret key</button>
        </div>
      </div>
      {createdKey && <div className="mb-4 rounded-md border border-info/20 bg-info-soft p-4 text-sm text-info">New key: <code>{createdKey}</code></div>}
      {error && <div className="mb-4 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
      <DataTable rows={keys} empty="No API keys yet." columns={[
        { key: "name", label: "Name", render: (row) => row.name },
        { key: "prefix", label: "Prefix", render: (row) => row.key_prefix },
        { key: "type", label: "Type", render: (row) => row.key_type },
        { key: "active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" },
        { key: "action", label: "", render: (row) => row.is_active ? <button className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => revokeKey(row.id)}>Revoke</button> : "-" },
      ]} />
    </>
  );
}
