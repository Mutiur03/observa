"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Globe2, Radio, RefreshCw, Smartphone, Users, Wifi } from "lucide-react";

import { DataTable } from "@/components/DataTable";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import { formatMetric, formatTime } from "@/lib/format";
import type { AnalyticsBreakdownItem, AnalyticsSummary, EventRow, OverviewStats, PresenceSnapshot } from "@/types";

function getWsBaseUrl() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  if (apiBase.startsWith("http")) return apiBase.replace(/^http/i, "ws");
  if (typeof window !== "undefined") return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${apiBase}`;
  return "ws://localhost:8000";
}

function uniqueCount(rows: EventRow[], key: "session_id" | "user_id" | "anonymous_id") {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function propertyValue(row: EventRow, key: string) {
  const value = row.properties?.[key];
  return typeof value === "string" && value ? value : null;
}

function topFromEvents(rows: EventRow[], key: string, fallback: AnalyticsBreakdownItem[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = propertyValue(row, key);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const live = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  return live.length ? live : fallback.slice(0, 6);
}

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: typeof Radio;
  tone?: "ink" | "green" | "blue";
}) {
  const classes = {
    ink: "border-border bg-surface",
    green: "border-emerald-100 bg-emerald-50/80",
    blue: "border-blue-100 bg-blue-50/70",
  };
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${classes[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted">{label}</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-ink">{formatMetric(value)}</div>
          <div className="mt-2 text-sm text-muted">{detail}</div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-white">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function BreakdownList({ title, items, empty, projectId }: { title: string; items: AnalyticsBreakdownItem[]; empty: string; projectId: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.label} href={`/projects/${projectId}/events?search=${encodeURIComponent(item.label)}`} className="block rounded-md p-1 transition hover:bg-surface-muted">
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{item.label}</span>
                <span className="shrink-0 font-medium text-muted">{formatMetric(item.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{empty}</div>
      )}
    </div>
  );
}

function ActivityBars({ events }: { events: EventRow[] }) {
  const buckets = useMemo(() => {
    const newestEventTime = events.reduce((latest, event) => Math.max(latest, new Date(event.timestamp).getTime()), 0);
    const now = newestEventTime ? Math.ceil(newestEventTime / 60_000) * 60_000 : 0;
    const points = Array.from({ length: 30 }, (_, index) => ({
      label: `${29 - index}m`,
      count: 0,
      from: now - (30 - index) * 60_000,
      to: now - (29 - index) * 60_000,
    }));
    for (const event of events) {
      const time = new Date(event.timestamp).getTime();
      const bucket = points.find((point) => time >= point.from && time < point.to);
      if (bucket) bucket.count += 1;
    }
    return points;
  }, [events]);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="flex h-44 items-end gap-1 rounded-md border border-border bg-surface-muted p-3">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-brand" style={{ height: `${Math.max(4, (bucket.count / max) * 100)}%` }} title={`${bucket.count} events`} />
        </div>
      ))}
    </div>
  );
}

export function RealtimeAnalyticsLive({
  projectId,
  initialStats,
  initialAnalytics,
  initialPresence,
  initialEvents,
}: {
  projectId: string;
  initialStats: OverviewStats;
  initialAnalytics: AnalyticsSummary;
  initialPresence: PresenceSnapshot;
  initialEvents: EventRow[];
}) {
  const [stats, setStats] = useState(initialStats);
  const [presence, setPresence] = useState(initialPresence);
  const [events, setEvents] = useState(initialEvents);
  const [overviewState, setOverviewState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [eventsState, setEventsState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [presenceState, setPresenceState] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      setOverviewState("connecting");
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/overview/ws?project_id=${encodeURIComponent(projectId)}&range=24h`);
      } catch {
        setOverviewState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => active && setOverviewState("live");
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: OverviewStats };
          if (message.type === "overview" && message.data) setStats(message.data);
        } catch {
          // Ignore malformed payloads.
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setOverviewState("reconnecting");
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

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      setEventsState("connecting");
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/events/ws?project_id=${encodeURIComponent(projectId)}`);
      } catch {
        setEventsState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => active && setEventsState("live");
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: EventRow | { id?: string; ids?: string[] } };
          if (message.type === "event.created" && message.data && "event_type" in message.data) {
            setEvents((current) => [message.data as EventRow, ...current.filter((row) => row.id !== (message.data as EventRow).id)].slice(0, 50));
          }
          if (message.type === "event.deleted" && message.data && "id" in message.data) {
            setEvents((current) => current.filter((row) => row.id !== message.data?.id));
          }
          if (message.type === "events.deleted" && message.data && "ids" in message.data) {
            const ids = new Set(message.data.ids ?? []);
            setEvents((current) => current.filter((row) => !ids.has(row.id)));
          }
        } catch {
          // Ignore malformed payloads.
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setEventsState("reconnecting");
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

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      setPresenceState("connecting");
      try {
        socket = new WebSocket(`${getWsBaseUrl()}/dashboard/presence/ws?project_id=${encodeURIComponent(projectId)}`);
      } catch {
        setPresenceState("reconnecting");
        retryTimer = setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => active && setPresenceState("live");
      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data as string) as { type?: string; data?: PresenceSnapshot };
          if (message.type === "presence" && message.data) setPresence(message.data);
        } catch {
          // Ignore malformed payloads.
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setPresenceState("reconnecting");
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

  const livePages = topFromEvents(events.filter((event) => event.event_type === "page_view"), "path", initialAnalytics.top_pages);
  const liveCountries = topFromEvents(events, "geo_country", initialAnalytics.countries);
  const liveDevices = topFromEvents(events, "device_type", initialAnalytics.devices);
  const liveSessions = uniqueCount(events, "session_id");
  const liveVisitors = uniqueCount(events, "user_id") + uniqueCount(events, "anonymous_id");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-3">
        <LiveConnectionStatus state={overviewState} label="Overview stream" refreshLabel="Updates every 2s" />
        <LiveConnectionStatus state={eventsState} label="Event stream" refreshLabel="Redis push events" />
        <LiveConnectionStatus state={presenceState} label="Presence stream" refreshLabel="Visitor heartbeat" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Online now" value={presence.online_users} detail={`${presence.active_sessions} active sessions`} icon={Wifi} tone="green" />
        <MetricTile label="24h active users" value={stats.active_users} detail="Users with recent events" icon={Users} tone="blue" />
        <MetricTile label="Live events" value={events.length} detail="Latest stream buffer" icon={Radio} />
        <MetricTile label="Live sessions" value={liveSessions} detail="In latest events" icon={Activity} />
        <MetricTile label="Live visitors" value={liveVisitors} detail="Identified and anonymous" icon={Globe2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Last 30 minutes</div>
              <div className="text-sm text-muted">Live event volume from the stream buffer.</div>
            </div>
            <RefreshCw className="h-5 w-5 text-muted" aria-hidden="true" />
          </div>
          <ActivityBars events={events} />
        </div>
        <BreakdownList title="Current top pages" items={livePages} empty="No live pages yet." projectId={projectId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownList title="Current countries" items={liveCountries} empty="No live geo data yet." projectId={projectId} />
        <BreakdownList title="Current devices" items={liveDevices} empty="No live device data yet." projectId={projectId} />
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Active visitors
          </div>
          <div className="space-y-2">
            {presence.visitors.slice(0, 6).map((visitor) => (
              <Link key={visitor.session_id} href={`/projects/${projectId}/sessions/${encodeURIComponent(visitor.session_id)}`} className="block rounded-md border border-border bg-surface-muted p-3 text-sm hover:bg-surface">
                <div className="truncate font-medium text-ink">{visitor.user_id ?? visitor.anonymous_id}</div>
                <div className="mt-1 truncate text-muted">{visitor.path ?? visitor.url ?? "Unknown page"}</div>
              </Link>
            ))}
            {!presence.visitors.length && <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">No visitors online.</div>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Live Event Stream</h2>
            <p className="text-sm text-muted">Newest events arrive here without refreshing the page.</p>
          </div>
          <Link href={`/projects/${projectId}/events`} className="text-sm font-medium underline decoration-border underline-offset-4">
            Open full Events
          </Link>
        </div>
        <DataTable
          rows={events}
          empty="No events received yet."
          columns={[
            { key: "type", label: "Type", render: (row) => row.event_type },
            { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
            { key: "page", label: "Page", render: (row) => propertyValue(row, "path") ?? "-" },
            {
              key: "session",
              label: "Session",
              render: (row) => row.session_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/sessions/${encodeURIComponent(row.session_id)}`}>{row.session_id}</Link> : "-",
            },
            { key: "time", label: "Time", render: (row) => formatTime(row.timestamp) },
          ]}
        />
      </div>
    </div>
  );
}
