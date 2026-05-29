"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";

type ApiKey = { id: string; name: string; key_prefix: string; key_type: string; is_active: boolean; key?: string };

export default function KeysPage({ params }: { params: { projectId: string } }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [createdKey, setCreatedKey] = useState("");

  async function load() {
    setKeys(await apiFetch<ApiKey[]>(`/projects/${params.projectId}/api-keys`));
  }

  async function createKey(key_type: "public" | "secret") {
    const key = await apiFetch<ApiKey>(`/projects/${params.projectId}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ name: `${key_type} key`, key_type }),
    });
    setCreatedKey(key.key ?? "");
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <div className="flex gap-2">
          <button onClick={() => createKey("public")} className="rounded-md border border-border bg-white px-3 py-2 text-sm">Public key</button>
          <button onClick={() => createKey("secret")} className="rounded-md bg-brand px-3 py-2 text-sm text-white">Secret key</button>
        </div>
      </div>
      {createdKey && <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">New key: <code>{createdKey}</code></div>}
      <DataTable rows={keys} empty="No API keys yet." columns={[
        { key: "name", label: "Name", render: (row) => row.name },
        { key: "prefix", label: "Prefix", render: (row) => row.key_prefix },
        { key: "type", label: "Type", render: (row) => row.key_type },
        { key: "active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" },
      ]} />
    </AppShell>
  );
}
