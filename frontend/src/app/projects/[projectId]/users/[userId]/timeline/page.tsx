import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function TimelinePage({ params }: { params: Promise<{ projectId: string; userId: string }> }) {
  const { projectId, userId } = await params;
  const rows = await serverApiFetch<EventRow[]>(`/dashboard/users/${userId}/timeline?project_id=${projectId}`);

  return (
    <AppShell projectId={projectId}>
      <h1 className="mb-5 text-2xl font-semibold">User Timeline</h1>
      <DataTable rows={rows} empty="No timeline events." columns={[
        { key: "type", label: "Type", render: (row) => row.event_type },
        { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
        { key: "time", label: "Time", render: (row) => new Date(row.timestamp).toLocaleString() },
      ]} />
    </AppShell>
  );
}
