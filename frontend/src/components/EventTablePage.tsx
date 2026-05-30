"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import type { EventRow } from "@/types";
import { apiFetch } from "@/lib/api";

export function EventTablePage({
  rows: initialRows,
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
  const [rows, setRows] = useState<EventRow[]>(initialRows);
  const [selected, setSelected] = useState<EventRow | undefined>(undefined);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const types = [
    ["", "All event types"],
    ["page_view", "Page view"],
    ["custom_event", "Custom event"],
    ["api_request", "API request"],
    ["frontend_error", "Frontend error"],
    ["backend_error", "Backend error"],
  ];

  useEffect(() => {
    // keep rows in sync when server provides a new initialRows (e.g., when filter link navigates)
    setRows(initialRows);

    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const startPolling = () => {
      if (pollTimer) return;
      setConnectionState("reconnecting");
      pollTimer = setInterval(async () => {
        try {
          const url = `/dashboard/events?project_id=${encodeURIComponent(projectId)}${currentType ? `&event_type=${encodeURIComponent(currentType)}` : ""}`;
          const data = await apiFetch<{ items: EventRow[] }>(url);
          if (!active) return;
          setRows(data.items);
        } catch (err) {
          console.debug("events polling error", err);
        }
      }, 3000);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    const getWsBaseUrl = () => {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL as string) || "";
      if (apiBase.startsWith("http")) {
        return apiBase.replace(/^http/i, "ws");
      }
      if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        return `${protocol}//${host}${apiBase}`;
      }
      return "ws://localhost:8000";
    };

    const connect = () => {
      if (!active) return;
      setConnectionState((current) => (current === "live" ? current : "connecting"));
      try {
        const url = `${getWsBaseUrl()}/dashboard/events/ws?project_id=${encodeURIComponent(projectId)}`;
        socket = new WebSocket(url);
      } catch (err) {
        startPolling();
        return;
      }

      socket.onopen = () => {
        if (!active) return;
        setConnectionState("live");
        stopPolling();
      };

      socket.onmessage = (ev) => {
        if (!active) return;
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string; data?: EventRow };
          if (msg && msg.type && msg.data) {
            // if a filter is active, ignore messages that don't match
            if (currentType && msg.data.event_type && msg.data.event_type !== currentType) {
              return;
            }
            // prepend new events
            setRows((current) => [msg.data as EventRow, ...current]);
          }
        } catch (err) {
          console.debug("events ws message parse error", err);
        }
      };

      socket.onclose = (event) => {
        if (!active) return;
        startPolling();
        retryTimer = setTimeout(() => {
          if (!active) return;
          connect();
        }, 5000);
      };

      socket.onerror = (ev) => {
        socket?.close();
      };
    };

    connect();

    return () => {
      active = false;
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [projectId, currentType, initialRows]);

  useEffect(() => {
    if (selected && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [selected]);

  return (
    <>
      <LiveConnectionStatus state={connectionState} label="Websocket" refreshLabel="Fallback polling every 3s" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Project feed</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map(([value, label]) => (
            <Link
              key={value}
              href={value ? `${basePath}?event_type=${value}` : basePath}
              className={`rounded-full border border-border px-3 py-2 text-sm transition-colors ${currentType === value ? "bg-brand text-white shadow-sm" : "bg-surface hover:bg-surface-muted"}`}
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
          {
            key: "details",
            label: "Details",
            render: (row) => (
              <button
                onClick={() => setSelected(row)}
                className="rounded-md border border-border px-2 py-1 text-sm bg-surface hover:bg-surface-muted"
              >
                View
              </button>
            ),
          },
        ]}
      />
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Event details dialog"
          onKeyDown={(e) => {
            if (e.key === "Escape") setSelected(undefined);
          }}
        >
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Event details</h2>
              <button
                ref={closeButtonRef}
                onClick={() => setSelected(undefined)}
                className="rounded-full border border-border bg-surface-muted px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </>
  );
}
