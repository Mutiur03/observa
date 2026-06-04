"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, BarChart3, Gauge, Globe2, Laptop, MapPin, Search, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { AnalyticsControlBar, type AnalyticsRange } from "@/components/AnalyticsControlBar";
import { DataTable } from "@/components/DataTable";
import { formatDateTime, formatMetric } from "@/lib/format";
import type { AnalyticsBreakdownItem, EventRow, PageDetailSummary } from "@/types";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "ink",
  href,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: typeof Globe2;
  tone?: "ink" | "blue" | "green" | "red";
  href?: string;
}) {
  const tones = {
    ink: "border-border bg-surface",
    blue: "border-blue-100 bg-blue-50/70",
    green: "border-emerald-100 bg-emerald-50/80",
    red: "border-red-100 bg-red-50/80",
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-muted">{label}</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-ink">{formatMetric(value)}</div>
          <div className="mt-2 text-sm text-muted">{detail}</div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-white">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`block rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`}>
        {body}
      </Link>
    );
  }

  return <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>{body}</div>;
}

function LineChart({ points }: { points: PageDetailSummary["series"] }) {
  const width = 640;
  const height = 176;
  const padding = 18;
  const compact = points.slice(-24);
  const max = Math.max(1, ...compact.map((point) => point.page_views));

  if (!compact.length) {
    return <div className="grid h-44 place-items-center rounded-md border border-border bg-surface-muted text-sm text-muted">No page views in this range</div>;
  }

  const step = compact.length > 1 ? (width - padding * 2) / (compact.length - 1) : 0;
  const coords = compact.map((point, index) => ({
    ...point,
    x: padding + index * step,
    y: height - padding - (point.page_views / max) * (height - padding * 2),
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-muted">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Page traffic trend">
        <polygon points={area} className="fill-brand/10" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => (
          <circle key={`${point.timestamp}-${point.x}`} cx={point.x} cy={point.y} r="4" className="fill-brand">
            <title>{`${formatMetric(point.page_views)} views / ${formatMetric(point.visitors)} visitors`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function BreakdownList({ title, items, empty }: { title: string; items: AnalyticsBreakdownItem[]; empty: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{item.label}</span>
                <span className="shrink-0 font-medium text-muted">{formatMetric(item.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{empty}</div>
      )}
    </div>
  );
}

export function PageDetailView({
  projectId,
  range,
  detail,
  events,
}: {
  projectId: string;
  range: AnalyticsRange;
  detail: PageDetailSummary;
  events: EventRow[];
}) {
  const router = useRouter();
  const [path, setPath] = useState(detail.path);
  const eventSearchHref = `/projects/${projectId}/events?search=${encodeURIComponent(detail.path)}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = path.trim();
    if (!value) return;
    const params = new URLSearchParams({ path: value });
    if (range !== "24h") params.set("range", range);
    router.push(`/projects/${projectId}/pages?${params}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href={`/projects/${projectId}`} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" />
            Overview
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Page detail</p>
          <h1 className="mt-1 break-words text-2xl font-semibold">{detail.path}</h1>
        </div>
        <form onSubmit={submit} className="flex min-w-0 overflow-hidden rounded-md border border-border bg-surface shadow-sm lg:w-[440px]">
          <span className="grid w-10 shrink-0 place-items-center text-muted">
            <Search size={16} aria-hidden="true" />
          </span>
          <input value={path} onChange={(event) => setPath(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="/pricing" />
          <button type="submit" className="border-l border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">
            Open
          </button>
        </form>
      </div>

      <AnalyticsControlBar projectId={projectId} range={range} compare={false} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Views" value={detail.page_views} detail="Bot-filtered page views" icon={Globe2} tone="blue" href={`/projects/${projectId}/events?event_type=page_view&search=${encodeURIComponent(detail.path)}`} />
        <MetricCard label="Visitors" value={detail.visitors} detail="Unique visitors" icon={Users} tone="green" href={eventSearchHref} />
        <MetricCard label="Sessions" value={detail.sessions} detail="Sessions that viewed page" icon={Activity} href={`/projects/${projectId}/sessions`} />
        <MetricCard label="Events" value={detail.events} detail="All events on this path" icon={BarChart3} href={eventSearchHref} />
        <MetricCard label="Errors" value={detail.errors} detail="Errors tied to this path" icon={AlertTriangle} tone={detail.errors ? "red" : "ink"} href={`${eventSearchHref}&event_type=frontend_error`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Traffic trend</div>
              <div className="text-sm text-muted">Views and visitors for this page.</div>
            </div>
            <BarChart3 className="h-5 w-5 text-muted" aria-hidden="true" />
          </div>
          <LineChart points={detail.series} />
        </div>
        <BreakdownList title="Referrers" items={detail.referrers} empty="No referrer data for this page." />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BreakdownList title="Countries" items={detail.countries} empty="No country data." />
        <BreakdownList title="Cities" items={detail.cities} empty="No city data." />
        <BreakdownList title="Devices" items={detail.devices} empty="No device data." />
        <BreakdownList title="Browsers" items={detail.browsers} empty="No browser data." />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Core Web Vitals</div>
            <div className="text-sm text-muted">Performance measurements collected on this page.</div>
          </div>
          <Gauge className="h-5 w-5 text-muted" aria-hidden="true" />
        </div>
        {detail.web_vitals.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {detail.web_vitals.map((metric) => (
              <div key={metric.name} className="rounded-md border border-border bg-surface-muted p-3">
                <div className="text-xs font-semibold uppercase text-muted">{metric.name}</div>
                <div className="mt-2 text-2xl font-semibold text-ink">{formatMetric(metric.p75)}</div>
                <div className="mt-1 text-xs text-muted">p75 / avg {formatMetric(metric.average)} / n {formatMetric(metric.count)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">No web vital events for this page yet.</div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Geo signal
            </div>
            <p className="text-sm text-muted">Country and city breakdowns depend on deployment headers from Cloudflare, Vercel, or another edge proxy.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Laptop className="h-4 w-4" aria-hidden="true" />
              Device signal
            </div>
            <p className="text-sm text-muted">Device and browser data comes from SDK-enriched event properties.</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Events on this page</h2>
              <p className="text-sm text-muted">Latest matching events, sessions, and users.</p>
            </div>
            <Link href={eventSearchHref} className="text-sm font-medium underline decoration-border underline-offset-4">
              Open full event search
            </Link>
          </div>
          <DataTable
            rows={events}
            empty="No matching events for this page."
            columns={[
              { key: "type", label: "Type", render: (row) => row.event_type },
              { key: "name", label: "Name", render: (row) => row.event_name ?? "-" },
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
