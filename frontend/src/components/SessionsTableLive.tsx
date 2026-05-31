"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import { apiFetch } from "@/lib/api";
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

export function SessionsTableLive({ projectId, initialRows }: { projectId: string; initialRows: SessionSummaryRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const data = await apiFetch<{ items: SessionSummaryRow[] }>(`/dashboard/sessions?project_id=${encodeURIComponent(projectId)}`);
        if (active) setRows(data.items);
      } catch (err) {
        console.debug("sessions refresh error", err);
      }
    };
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
        refresh();
      };
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: LiveEvent };
          if (message.type === "event.created" && message.data) {
            addEvent(message.data);
          }
          if (message.type === "event.deleted" || message.type === "events.deleted") {
            refresh();
          }
        } catch (err) {
          console.debug("sessions ws message parse error", err);
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

  return (
    <>
      <LiveConnectionStatus state={connectionState} label="Live sessions" refreshLabel="Websocket push with reconnect sync" />
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
          { key: "first", label: "First seen", render: (row) => new Date(row.first_seen).toLocaleString() },
          { key: "last", label: "Last seen", render: (row) => new Date(row.last_seen).toLocaleString() },
        ]}
      />
    </>
  );
}
