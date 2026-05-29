import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import type { EventRow } from "@/types";

export function EventTablePage({
  rows,
  title,
  currentType,
  basePath,
  projectId,
}: {
  rows: EventRow[];
  title: string;
  currentType: string;
  basePath: string;
  projectId: string;
}) {
  const types = [
    ["", "All event types"],
    ["page_view", "Page view"],
    ["custom_event", "Custom event"],
    ["api_request", "API request"],
    ["frontend_error", "Frontend error"],
    ["backend_error", "Backend error"],
  ];

  return (
    <AppShell projectId={projectId}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex flex-wrap gap-2">
          {types.map(([value, label]) => (
            <Link
              key={value}
              href={value ? `${basePath}?event_type=${value}` : basePath}
              className={`rounded-md border border-border px-3 py-2 text-sm ${currentType === value ? "bg-brand text-white" : "bg-surface hover:bg-surface-muted"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
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
    </AppShell>
  );
}
