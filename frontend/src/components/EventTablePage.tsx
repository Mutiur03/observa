"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import type { EventRow } from "@/types";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatMetric } from "@/lib/format";

type EventFilters = {
  event_type?: string;
  session_id?: string;
  user_id?: string;
  anonymous_id?: string;
  trace_id?: string;
};

function isEventRow(value: unknown): value is EventRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<EventRow>;
  return typeof row.id === "string" && typeof row.event_type === "string" && typeof row.timestamp === "string" && !Number.isNaN(Date.parse(row.timestamp));
}

function getWsBaseUrl() {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL as string) || "";
  if (apiBase.startsWith("http")) return apiBase.replace(/^http/i, "ws");
  if (typeof window !== "undefined") return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${apiBase}`;
  return "ws://localhost:8000";
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
}

function matches(row: EventRow, filters: EventFilters, search: string) {
  if (filters.event_type && row.event_type !== filters.event_type) return false;
  if (filters.session_id && row.session_id !== filters.session_id) return false;
  if (filters.user_id && row.user_id !== filters.user_id) return false;
  if (filters.anonymous_id && row.anonymous_id !== filters.anonymous_id) return false;
  if (filters.trace_id && row.trace_id !== filters.trace_id) return false;
  if (!search) return true;
  return [row.event_name, row.user_id, row.anonymous_id, row.session_id, row.trace_id]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(search.toLowerCase()));
}

function queryString(projectId: string, filters: EventFilters, search = "") {
  const params = new URLSearchParams({ project_id: projectId });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (search) params.set("search", search);
  return params.toString();
}

export function EventTablePage({
  rows: initialRows,
  total,
  page,
  pageSize,
  title,
  basePath,
  projectId,
  filters = {},
  description = "Search activity, inspect context, or drill into a user, session, or trace.",
  showTypeFilters = true,
  initialSearch = "",
  syncSearchToUrl = false,
}: {
  rows: EventRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  title: string;
  basePath: string;
  projectId: string;
  filters?: EventFilters;
  description?: string;
  showTypeFilters?: boolean;
  initialSearch?: string;
  syncSearchToUrl?: boolean;
}) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [rows, setRows] = useState<EventRow[]>(initialRows);
  const [selected, setSelected] = useState<EventRow>();
  const [search, setSearch] = useState(initialSearch);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const stableFilters = useMemo(() => filters, [filters.anonymous_id, filters.event_type, filters.session_id, filters.trace_id, filters.user_id]);
  const types = [
    ["", "All"],
    ["page_view", "Page view"],
    ["custom_event", "Custom"],
    ["api_request", "API"],
    ["frontend_error", "Frontend error"],
    ["backend_error", "Backend error"],
  ];
  const uniqueUsers = new Set(rows.map((row) => row.user_id ?? row.anonymous_id).filter(Boolean)).size;
  const uniqueSessions = new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
  const errorRows = rows.filter((row) => row.event_type.includes("error")).length;
  const currentPage = page ?? 1;
  const currentPageSize = pageSize ?? 25;
  const totalRows = total ?? rows.length;

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!syncSearchToUrl) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      Object.entries(stableFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      if (search) params.set("search", search);
      const nextSearch = params.toString();
      if (nextSearch !== currentSearchParams.toString()) {
        router.replace(`${basePath}${nextSearch ? `?${nextSearch}` : ""}`);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [basePath, currentSearchParams, router, search, stableFilters, syncSearchToUrl]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/events/ws?project_id=${encodeURIComponent(projectId)}`);
      } catch {
        setConnectionState("reconnecting");
        return;
      }
      socket.onopen = () => {
        if (!active) return;
        setConnectionState("live");
        router.refresh();
      };
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: unknown };
          if (message.type === "event.created" && isEventRow(message.data) && matches(message.data, stableFilters, search)) {
            setRows((current) => [message.data as EventRow, ...current.filter((row) => row.id !== (message.data as EventRow).id)]);
          }
          if (message.type === "event.deleted" && message.data && typeof message.data === "object") {
            const id = (message.data as { id?: string }).id;
            setRows((current) => current.filter((row) => row.id !== id));
          }
          if (message.type === "events.deleted" && message.data && typeof message.data === "object") {
            const ids = new Set((message.data as { ids?: string[] }).ids ?? []);
            setRows((current) => current.filter((row) => !ids.has(row.id)));
          }
        } catch (err) {
          debugLog("events ws message parse error", err);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setConnectionState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [projectId, router, search, stableFilters]);

  useEffect(() => {
    if (selected) closeButtonRef.current?.focus();
  }, [selected]);

  async function deleteEvent(id: string) {
    if (!window.confirm("Delete this event permanently? This cannot be undone.")) return;
    await apiFetch(`/dashboard/events/${id}?project_id=${encodeURIComponent(projectId)}`, { method: "DELETE" });
    setRows((current) => current.filter((row) => row.id !== id));
    setSelected(undefined);
    router.refresh();
  }

  async function clearEvents() {
    const scope = Object.values(stableFilters).some(Boolean) || search ? "matching events" : "all project events";
    if (!window.confirm(`Delete ${scope} permanently? This cannot be undone.`)) return;
    await apiFetch(`/dashboard/events?${queryString(projectId, stableFilters, search)}`, { method: "DELETE" });
    setRows([]);
    router.refresh();
  }

  return (
    <>
      <LiveConnectionStatus state={connectionState} label="Live events" refreshLabel="Fallback polling every 3s" />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Activity explorer</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <button onClick={clearEvents} className="w-full rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger sm:w-auto">
          Clear filtered events
        </button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Events shown" value={rows.length} />
        <InfoTile label="Users" value={uniqueUsers} />
        <InfoTile label="Sessions" value={uniqueSessions} />
        <InfoTile label="Errors" value={errorRows} />
      </div>
      <div className="mb-4 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, user, anonymous ID, session, or trace..."
            className="min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <Link
            href={`/projects/${projectId}/events`}
            onClick={() => setSearch("")}
            className="rounded-md border border-border bg-surface px-3 py-2 text-center text-sm font-medium hover:bg-surface-muted"
          >
            Clear filters
          </Link>
        </div>
        {showTypeFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {types.map(([value, label]) => {
              const params = new URLSearchParams();
              Object.entries(stableFilters).forEach(([key, filterValue]) => {
                if (key !== "event_type" && filterValue) params.set(key, filterValue);
              });
              if (value) params.set("event_type", value);
              return (
                <Link key={value} href={`${basePath}${params.size ? `?${params}` : ""}`} className={`rounded-md border border-border px-3 py-1.5 text-sm ${stableFilters.event_type === value ? "bg-brand text-white" : "bg-surface hover:bg-surface-muted"}`}>
                  {label}
                </Link>
              );
            })}
          </div>
        )}
        {Object.entries(stableFilters).some(([, value]) => value) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            {Object.entries(stableFilters).filter(([, value]) => value).map(([key, value]) => <span key={key} className="rounded-full bg-surface-muted px-2 py-1">{key}: {value}</span>)}
          </div>
        )}
      </div>
      <DataTable
        rows={rows}
        empty={`No ${title.toLowerCase()} found.`}
        columns={[
          { key: "type", label: "Type", render: (row) => row.event_type },
          { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
          {
            key: "user",
            label: "User",
            render: (row) => row.user_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/users/${encodeURIComponent(row.user_id)}/timeline`}>{row.user_id}</Link> : row.anonymous_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/events?anonymous_id=${encodeURIComponent(row.anonymous_id)}`}>{row.anonymous_id}</Link> : "-",
          },
          { key: "trace", label: "Trace", render: (row) => row.trace_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/events?trace_id=${encodeURIComponent(row.trace_id)}`}>{row.trace_id}</Link> : "-" },
          {
            key: "session",
            label: "Session",
            render: (row) => row.session_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/sessions/${encodeURIComponent(row.session_id)}`}>{row.session_id}</Link> : "-",
          },
          { key: "time", label: "Time", render: (row) => formatDateTime(row.timestamp) },
          {
            key: "actions",
            label: "",
            render: (row) => <div className="flex flex-wrap gap-2"><button onClick={() => setSelected(row)} className="rounded-md border border-border px-2 py-1 text-sm">View</button><button onClick={() => deleteEvent(row.id)} className="rounded-md border border-danger/30 px-2 py-1 text-sm text-danger">Delete</button></div>,
          },
        ]}
      />
      <Pagination basePath={basePath} filters={stableFilters} search={search} page={currentPage} pageSize={currentPageSize} total={totalRows} />
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Event details dialog" onKeyDown={(event) => { if (event.key === "Escape") setSelected(undefined); }}>
          <div className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Event details</h2>
              <button ref={closeButtonRef} onClick={() => setSelected(undefined)} className="rounded-full border border-border bg-surface-muted px-3 py-1 text-sm">Close</button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </>
  );
}

function Pagination({
  basePath,
  filters,
  search,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  filters: EventFilters;
  search: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (search) params.set("search", search);
    if (nextPage > 1) params.set("page", String(nextPage));
    params.set("page_size", String(pageSize));
    return `${basePath}?${params}`;
  };

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted">Page {page} of {totalPages} · {formatMetric(total)} total</div>
      <div className="flex gap-2">
        <Link className={`rounded-md border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-surface-muted"}`} href={hrefFor(Math.max(1, page - 1))}>Previous</Link>
        <Link className={`rounded-md border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-surface-muted"}`} href={hrefFor(Math.min(totalPages, page + 1))}>Next</Link>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
