"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { apiFetch } from "@/lib/api";
import type { EventRow } from "@/types";

export default function TimelinePage({ params }: { params: { projectId: string; userId: string } }) {
  const [rows, setRows] = useState<EventRow[]>([]);

  useEffect(() => {
    apiFetch<EventRow[]>(`/dashboard/users/${params.userId}/timeline?project_id=${params.projectId}`).then(setRows);
  }, [params.projectId, params.userId]);

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-semibold">User Timeline</h1>
      <DataTable rows={rows} empty="No timeline events." columns={[
        { key: "type", label: "Type", render: (row) => row.event_type },
        { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
        { key: "time", label: "Time", render: (row) => new Date(row.timestamp).toLocaleString() },
      ]} />
    </AppShell>
  );
}
