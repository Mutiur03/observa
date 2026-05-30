import { DataTable } from "@/components/DataTable";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const { projectId, sessionId } = await params;
  const rows = await serverApiFetch<EventRow[]>(`/dashboard/events?project_id=${projectId}&session_id=${sessionId}`);

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Session detail</p>
          <h1 className="mt-1 text-2xl font-semibold">{sessionId}</h1>
        </div>
        <p className="text-sm text-muted">All events captured in this session.</p>
      </div>

      <DataTable
        rows={rows}
        empty="No events found for this session."
        columns={[
          { key: "type", label: "Type", render: (row) => row.event_type ?? row.event_name ?? "event" },
          { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
          { key: "user", label: "User", render: (row) => row.user_id ?? "-" },
          { key: "trace", label: "Trace", render: (row) => row.trace_id ?? "-" },
          { key: "time", label: "Time", render: (row) => new Date(row.timestamp).toLocaleString() },
        ]}
      />
    </>
  );
}