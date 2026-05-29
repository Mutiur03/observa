"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import type { EventRow } from "@/types";

export function EventPage({ projectId, title, endpoint }: { projectId: string; title: string; endpoint: string }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("");

  useEffect(() => {
    const query = endpoint.includes("?") ? "&" : "?";
    apiFetch<{ items: EventRow[] }>(`${endpoint}${query}project_id=${projectId}${eventType ? `&event_type=${eventType}` : ""}`)
      .then((data) => setRows(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, eventType, projectId]);

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <select className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm sm:w-56" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="">All event types</option>
          <option value="page_view">Page view</option>
          <option value="custom_event">Custom event</option>
          <option value="api_request">API request</option>
          <option value="frontend_error">Frontend error</option>
          <option value="backend_error">Backend error</option>
        </select>
      </div>
      {loading && <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">Loading...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && (
        <DataTable
          rows={rows}
          empty={`No ${title.toLowerCase()} found.`}
          columns={[
            { key: "type", label: "Type", render: (row) => row.event_type ?? row.event_name ?? "event" },
            { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
            { key: "user", label: "User", render: (row) => row.user_id ?? "-" },
            { key: "trace", label: "Trace", render: (row) => row.trace_id ?? "-" },
            { key: "time", label: "Time", render: (row) => new Date(row.timestamp).toLocaleString() },
          ]}
        />
      )}
    </AppShell>
  );
}
