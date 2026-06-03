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
  const [createdKeyType, setCreatedKeyType] = useState<"public" | "secret">();
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
      setCreatedKeyType(key_type);
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

  const presenceScriptUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/v1/presence.js`;
  const presenceSnippet = createdKeyType === "public" && createdKey
    ? `<script src="${presenceScriptUrl}" data-api-key="${createdKey}" defer></script>`
    : `<script src="${presenceScriptUrl}" data-api-key="obspk_YOUR_PUBLIC_KEY" defer></script>`;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
          <input className="min-w-0 rounded-md border border-border px-3 py-2 text-sm" value={keyName} onChange={(event) => setKeyName(event.target.value)} />
          <button onClick={() => createKey("public")} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted">Public key</button>
          <button onClick={() => createKey("secret")} className="rounded-md bg-brand px-3 py-2 text-sm text-white hover:bg-brand-strong">Secret key</button>
        </div>
      </div>
      {createdKey && <div className="mb-4 rounded-md border border-info/20 bg-info-soft p-4 text-sm text-info">New key: <code className="break-all">{createdKey}</code></div>}
      {error && <div className="mb-4 rounded-md border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
      <div className="mb-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">Website presence tracking</h2>
        <p className="mt-1 text-sm text-muted">Add this one tag to your website. No SDK needed. It sends a heartbeat every 20 seconds and visitors expire after 60 seconds.</p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-ink p-3 text-xs text-white">{presenceSnippet}</pre>
        <p className="mt-3 text-sm text-muted">After login, identify user with <code className="break-all rounded bg-surface-muted px-1 py-0.5">window.ObservaPresence.identify("user_123")</code>.</p>
      </div>
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
