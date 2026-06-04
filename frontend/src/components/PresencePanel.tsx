"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import { formatTime } from "@/lib/format";
import type { PresenceSnapshot } from "@/types";

function getWsBaseUrl() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  if (apiBase.startsWith("http")) return apiBase.replace(/^http/i, "ws");
  if (typeof window !== "undefined") return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${apiBase}`;
  return "ws://localhost:8000";
}

export function PresencePanel({ projectId, initialPresence }: { projectId: string; initialPresence: PresenceSnapshot }) {
  const [presence, setPresence] = useState(initialPresence);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      setConnectionState("connecting");
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/presence/ws?project_id=${encodeURIComponent(projectId)}`);
      } catch {
        setConnectionState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => active && setConnectionState("live");
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: PresenceSnapshot };
          if (message.type === "presence" && message.data) setPresence(message.data);
        } catch {
          // Ignore malformed websocket payload.
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
    <section className="mt-6">
      <LiveConnectionStatus state={connectionState} label="Presence websocket" refreshLabel="Heartbeat TTL: 60s" />
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Online Visitors</h2>
        <p className="text-sm text-muted">{presence.online_users} online users across {presence.active_sessions} active sessions. {presence.identified_users} identified, {presence.anonymous_users} anonymous.</p>
      </div>
      <DataTable
        rows={presence.visitors}
        empty="No visitors online. Add presence script to your website to begin tracking."
        columns={[
          {
            key: "visitor",
            label: "Visitor",
            render: (row) => row.user_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/users/${encodeURIComponent(row.user_id)}/timeline`}>{row.user_id}</Link> : row.anonymous_id,
          },
          {
            key: "session",
            label: "Session",
            render: (row) => <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/sessions/${encodeURIComponent(row.session_id)}`}>{row.session_id}</Link>,
          },
          { key: "page", label: "Current page", render: (row) => row.path ?? "-" },
          { key: "seen", label: "Last seen", render: (row) => formatTime(row.last_seen) },
        ]}
      />
    </section>
  );
}
