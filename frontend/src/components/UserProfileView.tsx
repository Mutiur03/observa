import Link from "next/link";
import { Activity, AlertTriangle, CalendarDays, Clock3, Globe2, Laptop, MousePointerClick, UserRound } from "lucide-react";

import { DataTable } from "@/components/DataTable";
import { formatDateTime, formatMetric } from "@/lib/format";
import type { AnalyticsBreakdownItem, EventRow, UserProfileSummary } from "@/types";

function MetricCard({ label, value, detail, icon: Icon, tone = "ink" }: { label: string; value: number | string; detail: string; icon: typeof UserRound; tone?: "ink" | "blue" | "red" }) {
  const classes = {
    ink: "border-border bg-surface",
    blue: "border-blue-100 bg-blue-50/70",
    red: "border-red-100 bg-red-50/80",
  };
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${classes[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted">{label}</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-ink">{formatMetric(value)}</div>
          <div className="mt-2 text-sm text-muted">{detail}</div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-white"><Icon size={20} aria-hidden="true" /></span>
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
            <Link key={item.label} href={`/projects/${projectId}/events?search=${encodeURIComponent(item.label)}`} className="block rounded-md p-1 hover:bg-surface-muted">
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{item.label}</span>
                <span className="shrink-0 text-muted">{formatMetric(item.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
              </div>
            </Link>
          ))}
        </div>
      ) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{empty}</div>}
    </div>
  );
}

export function UserProfileView({ projectId, profile, events }: { projectId: string; profile: UserProfileSummary; events: EventRow[] }) {
  const initials = profile.user_id.slice(0, 2).toUpperCase();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-ink text-lg font-semibold text-white">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">User profile</p>
          <h1 className="mt-1 break-words text-2xl font-semibold">{profile.user_id}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>First seen: {profile.first_seen ? formatDateTime(profile.first_seen) : "Unknown"}</span>
            <span>Last seen: {profile.last_seen ? formatDateTime(profile.last_seen) : "Unknown"}</span>
          </div>
        </div>
        <Link href={`/projects/${projectId}/events?user_id=${encodeURIComponent(profile.user_id)}`} className="rounded-md border border-border px-3 py-2 text-center text-sm font-medium hover:bg-surface-muted">
          Open filtered events
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Events" value={profile.event_count} detail="All tracked activity" icon={MousePointerClick} tone="blue" />
        <MetricCard label="Sessions" value={profile.session_count} detail="Unique sessions" icon={Activity} />
        <MetricCard label="Page views" value={profile.page_view_count} detail="Pages viewed" icon={Globe2} />
        <MetricCard label="Errors" value={profile.error_count} detail="Errors encountered" icon={AlertTriangle} tone={profile.error_count ? "red" : "ink"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <BreakdownList title="Top pages" items={profile.top_pages} empty="No page data." projectId={projectId} />
        <BreakdownList title="Countries" items={profile.countries} empty="No country data." projectId={projectId} />
        <BreakdownList title="Devices" items={profile.devices} empty="No device data." projectId={projectId} />
        <BreakdownList title="Browsers" items={profile.browsers} empty="No browser data." projectId={projectId} />
        <BreakdownList title="Referrers" items={profile.referrers} empty="No referrer data." projectId={projectId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.65fr_1.35fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays className="h-4 w-4" />Lifecycle</div>
            <p className="text-sm text-muted">This profile groups identified events by the stable user ID provided by your application.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Laptop className="h-4 w-4" />Context</div>
            <p className="text-sm text-muted">Device, browser, geo, and acquisition context comes from event properties collected by the SDK.</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Activity timeline</h2>
              <p className="text-sm text-muted">Latest events from this identified user.</p>
            </div>
            <Clock3 className="h-5 w-5 text-muted" aria-hidden="true" />
          </div>
          <DataTable
            rows={events}
            empty="No events found for this user."
            columns={[
              { key: "type", label: "Type", render: (row) => row.event_type },
              { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
              { key: "page", label: "Page", render: (row) => typeof row.properties.path === "string" ? row.properties.path : "-" },
              {
                key: "session",
                label: "Session",
                render: (row) => row.session_id ? <Link className="underline decoration-border underline-offset-4" href={`/projects/${projectId}/sessions/${encodeURIComponent(row.session_id)}`}>{row.session_id}</Link> : "-",
              },
              { key: "time", label: "Time", render: (row) => formatDateTime(row.timestamp) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
