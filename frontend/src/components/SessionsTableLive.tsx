"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import { formatDateTime, formatMetric } from "@/lib/format";
import type { SessionSummaryRow } from "@/types";

type LiveEvent = {
  session_id?: string | null;
  user_id?: string | null;
  anonymous_id?: string | null;
  timestamp?: string;
};

function getWsBaseUrl() {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL as string) || "";
  if (apiBase.startsWith("http")) return apiBase.replace(/^http/i, "ws");
  if (typeof window !== "undefined") return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${apiBase}`;
  return "ws://localhost:8000";
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug(...args);
}

export function SessionsTableLive({
  projectId,
  initialRows,
  total,
  page,
  pageSize,
}: {
  projectId: string;
  initialRows: SessionSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const addEvent = (event: LiveEvent) => {
      if (!event.session_id || !event.timestamp) return;
      setRows((current) => {
        const existing = current.find((row) => row.session_id === event.session_id);
        const next = existing
          ? current.map((row) => row.session_id === event.session_id ? {
              ...row,
              user_id: row.user_id ?? event.user_id ?? null,
              anonymous_id: row.anonymous_id ?? event.anonymous_id ?? null,
              event_count: row.event_count + 1,
              last_seen: event.timestamp!,
            } : row)
          : [{
              session_id: event.session_id!,
              user_id: event.user_id ?? null,
              anonymous_id: event.anonymous_id ?? null,
              event_count: 1,
              first_seen: event.timestamp!,
              last_seen: event.timestamp!,
            }, ...current];
        return next.sort((left, right) => new Date(right.last_seen).getTime() - new Date(left.last_seen).getTime());
      });
    };
    const connect = () => {
      if (!active) return;
      setConnectionState("connecting");
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/events/ws?project_id=${encodeURIComponent(projectId)}`);
      } catch {
        setConnectionState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => {
        if (!active) return;
        setConnectionState("live");
      };
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: LiveEvent };
          if (message.type === "event.created" && message.data) {
            addEvent(message.data);
          }
          if (message.type === "event.deleted" || message.type === "events.deleted") {
            // Live updates already handle additions; deletions will reconcile on navigation.
          }
        } catch (err) {
          debugLog("sessions ws message parse error", err);
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
  }, [projectId]);

  const identifiedUsers = new Set(rows.map((row) => row.user_id).filter(Boolean)).size;
  const anonymousUsers = new Set(rows.map((row) => row.anonymous_id).filter(Boolean)).size;
  const totalEvents = rows.reduce((sum, row) => sum + row.event_count, 0);

  return (
    <>
      <LiveConnectionStatus state={connectionState} label="Live sessions" refreshLabel="Websocket push with reconnect sync" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Sessions" value={rows.length} />
        <InfoTile label="Events" value={totalEvents} />
        <InfoTile label="Identified users" value={identifiedUsers} />
        <InfoTile label="Anonymous users" value={anonymousUsers} />
      </div>
      <DataTable
        rows={rows}
        empty="No session activity yet. Once page views or events are tracked, sessions will appear here."
        columns={[
          {
            key: "session",
            label: "Session",
            render: (row) => <Link className="font-medium underline decoration-border underline-offset-4" href={`/projects/${projectId}/sessions/${encodeURIComponent(row.session_id)}`}>{row.session_id}</Link>,
          },
          { key: "events", label: "Events", render: (row) => row.event_count },
          {
            key: "user",
            label: "User",
            render: (row) => row.user_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/users/${encodeURIComponent(row.user_id)}/timeline`}>{row.user_id}</Link> : "-",
          },
          { key: "anonymous", label: "Anonymous", render: (row) => row.anonymous_id ?? "-" },
          { key: "first", label: "First seen", render: (row) => formatDateTime(row.first_seen) },
          { key: "last", label: "Last seen", render: (row) => formatDateTime(row.last_seen) },
        ]}
      />
      <Pagination basePath={`/projects/${projectId}/sessions`} page={page} pageSize={pageSize} total={total} />
    </>
  );
}

function Pagination({ basePath, page, pageSize, total }: { basePath: string; page: number; pageSize: number; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
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
