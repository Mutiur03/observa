"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CircleCheck, Flag, Gauge, GitBranch, Globe2, Lightbulb, MapPin, Radio, RefreshCw, ServerCrash, ShieldCheck, Users, UserPlus, Wifi } from "lucide-react";

import { AnalyticsControlBar } from "@/components/AnalyticsControlBar";
import { PresencePanel } from "@/components/PresencePanel";
import { apiFetch } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import type { AnalyticsBreakdownItem, AnalyticsSummary, AutomatedInsight, FunnelSummary, OverviewStats, PeriodComparison, PresenceSnapshot } from "@/types";

type ConnectionState = "connecting" | "live" | "reconnecting";
type OverviewRange = "24h" | "7d" | "30d" | "90d" | "all";
export type AnalyticsView = "overview" | "web" | "audience" | "funnels" | "performance" | "insights";
type MetricTone = "ink" | "blue" | "green" | "red" | "amber";

const defaultFunnelSteps = "page_view:*,custom_event:sign_up,custom_event:purchase";

const rangeLabel: Record<OverviewRange, string> = {
    "24h": "last 24 hours",
    "7d": "last 7 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    all: "all time",
};

const toneClass: Record<MetricTone, { card: string; icon: string; accent: string }> = {
    ink: { card: "border-border bg-surface", icon: "bg-surface-muted text-ink", accent: "bg-ink" },
    blue: { card: "border-blue-100 bg-blue-50/70", icon: "bg-blue-600 text-white", accent: "bg-blue-600" },
    green: { card: "border-emerald-100 bg-emerald-50/80", icon: "bg-emerald-600 text-white", accent: "bg-emerald-600" },
    red: { card: "border-red-100 bg-red-50/80", icon: "bg-red-600 text-white", accent: "bg-red-600" },
    amber: { card: "border-amber-100 bg-amber-50/80", icon: "bg-amber-600 text-white", accent: "bg-amber-600" },
};

function getWsBaseUrl() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    if (apiBase.startsWith("http")) {
        return apiBase.replace(/^http/i, "ws");
    }
    if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        return `${protocol}//${host}${apiBase}`;
    }
    return "ws://localhost:8000";
}

function overviewQuery(projectId: string, range: OverviewRange) {
    return `project_id=${encodeURIComponent(projectId)}&range=${encodeURIComponent(range)}`;
}

function overviewWsUrl(projectId: string, range: OverviewRange) {
    return `${getWsBaseUrl()}/dashboard/overview/ws?${overviewQuery(projectId, range)}`;
}

function debugLog(...args: unknown[]) {
    if (process.env.NODE_ENV !== "production") console.debug(...args);
}

function InsightCard({
    label,
    value,
    detail,
    icon: Icon,
    tone = "ink",
    href,
    delta,
}: {
    label: string;
    value: number | string;
    detail: string;
    icon: typeof Users;
    tone?: MetricTone;
    href?: string;
    delta?: number;
}) {
    const classes = toneClass[tone];
    const content = (
        <>
            <div className={`absolute inset-x-0 top-0 h-1 ${classes.accent}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                        <span>{label}</span>
                        {href && <ArrowUpRight size={13} aria-hidden="true" />}
                    </div>
                    <div className="mt-2 text-3xl font-semibold leading-none text-ink">{formatMetric(value)}</div>
                    <div className="mt-2 text-sm text-muted">{detail}</div>
                    {typeof delta === "number" && (
                        <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${delta >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs earlier window
                        </div>
                    )}
                </div>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${classes.icon}`}>
                    <Icon size={20} aria-hidden="true" />
                </span>
            </div>
        </>
    );

    if (href) {
        return (
            <Link href={href} className={`relative block overflow-hidden rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${classes.card}`}>
                {content}
            </Link>
        );
    }

    return (
        <div className={`relative overflow-hidden rounded-lg border p-4 shadow-sm ${classes.card}`}>
            {content}
        </div>
    );
}

function AutomatedInsightsPanel({ insights, href }: { insights: AutomatedInsight[]; href?: string }) {
    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                        Automated insights
                    </div>
                    <div className="mt-1 text-sm text-muted">Meaningful changes versus the previous equal period.</div>
                </div>
                {href ? <Link href={href} className="text-sm font-medium text-muted underline decoration-border underline-offset-4">View all</Link> : <span className="text-sm font-medium text-muted">{insights.length} detected</span>}
            </div>
            {insights.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                    {insights.map((insight, index) => (
                        <div
                            key={`${insight.kind}-${index}`}
                            className={`rounded-md border p-3 ${insight.severity === "critical"
                                    ? "border-red-200 bg-red-50"
                                    : insight.severity === "warning"
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-emerald-200 bg-emerald-50"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {insight.severity === "positive" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />}
                                <div>
                                    <div className="text-sm font-semibold text-ink">{insight.title}</div>
                                    <div className="mt-1 text-sm text-muted">{insight.description}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">No meaningful anomalies detected for this period.</div>
            )}
        </div>
    );
}

function PeriodComparisonPanel({ comparison }: { comparison: PeriodComparison }) {
    const rows = [
        ["Page views", comparison.page_views],
        ["Visitors", comparison.visitors],
        ["Page sessions", comparison.sessions],
        ["Active users", comparison.active_users],
        ["Events", comparison.events],
        ["Errors", comparison.errors],
    ] as const;
    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4">
                <div className="text-sm font-semibold text-ink">Period comparison</div>
                <div className="mt-1 text-sm text-muted">Selected period versus the immediately preceding equal-length period.</div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted">
                        <tr>
                            <th className="pb-2">Metric</th>
                            <th className="pb-2 text-right">Current</th>
                            <th className="pb-2 text-right">Previous</th>
                            <th className="pb-2 text-right">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(([label, metric]) => (
                            <tr key={label} className="border-b border-border/70 last:border-0">
                                <td className="py-3 font-medium text-ink">{label}</td>
                                <td className="py-3 text-right text-ink">{formatMetric(metric.current)}</td>
                                <td className="py-3 text-right text-muted">{formatMetric(metric.previous)}</td>
                                <td className={`py-3 text-right font-semibold ${metric.change_percent >= 0 ? "text-success" : "text-danger"}`}>
                                    {metric.change_percent >= 0 ? "+" : ""}{metric.change_percent.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MiniTrafficChart({ series }: { series: AnalyticsSummary["series"] }) {
    const compactSeries = series.slice(-24);

    if (!compactSeries.length) {
        return <div className="grid h-44 place-items-center rounded-md border border-border bg-surface-muted text-sm text-muted">No page views yet</div>;
    }

    return (
        <LineChart
            points={compactSeries.map((point) => ({ label: point.timestamp, value: point.page_views, secondary: point.visitors }))}
            label="views"
            secondaryLabel="visitors"
        />
    );
}

function LineChart({
    points,
    label,
    secondaryLabel,
}: {
    points: { label: string; value: number; secondary?: number }[];
    label: string;
    secondaryLabel?: string;
}) {
    const width = 640;
    const height = 176;
    const padding = 18;
    const max = Math.max(1, ...points.map((point) => point.value));
    const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const coords = points.map((point, index) => ({
        ...point,
        x: padding + index * step,
        y: height - padding - (point.value / max) * (height - padding * 2),
    }));
    const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;

    return (
        <div className="overflow-hidden rounded-md border border-border bg-surface-muted">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={`${label} trend`}>
                <polygon points={area} className="fill-brand/10" />
                <polyline points={line} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand" strokeLinecap="round" strokeLinejoin="round" />
                {coords.map((point) => (
                    <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4" className="fill-brand">
                        <title>{`${formatMetric(point.value)} ${label}${secondaryLabel && point.secondary !== undefined ? ` / ${formatMetric(point.secondary)} ${secondaryLabel}` : ""}`}</title>
                    </circle>
                ))}
            </svg>
        </div>
    );
}

function BreakdownList({
    title,
    items,
    empty,
    hrefForItem,
}: {
    title: string;
    items: AnalyticsBreakdownItem[];
    empty: string;
    hrefForItem?: (item: AnalyticsBreakdownItem) => string;
}) {
    const max = Math.max(1, ...items.map((item) => item.count));

    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
            {items.length ? (
                <div className="space-y-3">
                    {items.map((item) => {
                        const row = (
                            <>
                                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                    <span className="min-w-0 truncate text-ink">{item.label}</span>
                                    <span className="shrink-0 font-medium text-muted">{formatMetric(item.count)}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
                                </div>
                            </>
                        );
                        const href = hrefForItem?.(item);
                        return href ? (
                            <Link key={item.label} href={href} className="block rounded-md p-1 transition hover:bg-surface-muted">
                                {row}
                            </Link>
                        ) : (
                            <div key={item.label}>{row}</div>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">{empty}</div>
            )}
        </div>
    );
}

function WebVitalsPanel({ vitals }: { vitals: AnalyticsSummary["web_vitals"] }) {
    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-ink">Core Web Vitals</div>
                <Gauge className="h-5 w-5 text-muted" aria-hidden="true" />
            </div>
            {vitals.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {vitals.map((metric) => (
                        <div key={metric.name} className="rounded-md border border-border bg-surface-muted p-3">
                            <div className="text-xs font-semibold uppercase text-muted">{metric.name}</div>
                            <div className="mt-2 text-2xl font-semibold text-ink">{formatMetric(metric.p75)}</div>
                            <div className="mt-1 text-xs text-muted">p75 · avg {formatMetric(metric.average)} · n {formatMetric(metric.count)}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">No web vital events yet. New SDK traffic will populate this.</div>
            )}
        </div>
    );
}

function RetentionPanel({ retention }: { retention: AnalyticsSummary["retention"] }) {
    const latest = retention[retention.length - 1];
    const points = retention.map((point) => ({
        label: point.date,
        value: point.active_users,
        secondary: point.returning_users,
    }));

    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-ink">Retention</div>
                    <div className="text-sm text-muted">Daily active users, new users, and returning users.</div>
                </div>
                {latest && <div className="text-sm text-muted">{formatMetric(latest.returning_users)} returning / {formatMetric(latest.new_users)} new</div>}
            </div>
            {points.length ? <LineChart points={points} label="active users" secondaryLabel="returning" /> : <div className="grid h-44 place-items-center rounded-md border border-border bg-surface-muted text-sm text-muted">No retention data yet</div>}
        </div>
    );
}

function FunnelPanel({
    funnel,
    stepsText,
    onStepsTextChange,
    onApply,
}: {
    funnel: FunnelSummary;
    stepsText: string;
    onStepsTextChange: (value: string) => void;
    onApply: () => void;
}) {
    const max = Math.max(1, funnel.total_users);

    return (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <GitBranch className="h-4 w-4" aria-hidden="true" />
                        <span>Conversion funnel</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">Use ordered steps as event_type:event_name. Use * for any event name.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto] lg:min-w-[520px]">
                    <input
                        className="min-w-0 rounded-md border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
                        value={stepsText}
                        onChange={(event) => onStepsTextChange(event.target.value)}
                    />
                    <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong" onClick={onApply} type="button">
                        Apply
                    </button>
                </div>
            </div>

            {funnel.steps.length ? (
                <div className="space-y-3">
                    {funnel.steps.map((step, index) => (
                        <div key={`${step.event_type}:${step.event_name ?? ""}:${index}`} className="rounded-md border border-border bg-surface-muted p-3">
                            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-ink">{index + 1}. {step.label}</div>
                                    <div className="text-xs text-muted">{step.event_type}:{step.event_name || "*"}</div>
                                </div>
                                <div className="text-sm text-muted">
                                    <span className="font-semibold text-ink">{formatMetric(step.users)}</span> users · {step.conversion_rate}% conversion · {step.dropoff_rate}% drop-off
                                </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-surface">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, (step.users / max) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">No users matched the first funnel step in this range.</div>
            )}
        </div>
    );
}

function eventsWsUrl(projectId: string) {
    return `${getWsBaseUrl()}/dashboard/events/ws?project_id=${encodeURIComponent(projectId)}`;
}

export function ProjectOverviewLive({
    projectId,
    initialStats,
    initialAnalytics,
    initialFunnel,
    initialPresence,
    range,
    funnelSteps,
    compare,
    comparison,
    insights,
    view = "overview",
}: {
    projectId: string;
    initialStats: OverviewStats;
    initialAnalytics: AnalyticsSummary;
    initialFunnel: FunnelSummary;
    initialPresence: PresenceSnapshot;
    range: OverviewRange;
    funnelSteps: string;
    compare: boolean;
    comparison: PeriodComparison;
    insights: AutomatedInsight[];
    view?: AnalyticsView;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [stats, setStats] = useState(initialStats);
    const [analytics, setAnalytics] = useState(initialAnalytics);
    const [funnel, setFunnel] = useState(initialFunnel);
    const [funnelStepsText, setFunnelStepsText] = useState(funnelSteps);
    const [comparisonData, setComparisonData] = useState(comparison);
    const [insightsData, setInsightsData] = useState(insights);
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

    useEffect(() => {
        setStats(initialStats);
    }, [initialStats]);

    useEffect(() => {
        setAnalytics(initialAnalytics);
    }, [initialAnalytics]);

    useEffect(() => {
        setFunnel(initialFunnel);
    }, [initialFunnel]);

    useEffect(() => {
        setFunnelStepsText(funnelSteps);
    }, [funnelSteps]);

    useEffect(() => {
        setComparisonData(comparison);
    }, [comparison]);

    useEffect(() => {
        setInsightsData(insights);
    }, [insights]);

    const updateUrl = (nextRange: OverviewRange, nextSteps: string = funnelSteps) => {
        const params = new URLSearchParams();
        if (nextRange !== "24h") params.set("range", nextRange);
        if (compare) params.set("compare", "1");
        if (nextSteps !== defaultFunnelSteps) params.set("steps", nextSteps);
        router.push(`${pathname}${params.size ? `?${params}` : ""}`);
    };

    useEffect(() => {
        let active = true;
        let socket: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            if (!active) return;
            setConnectionState((current) => (current === "live" ? current : "connecting"));
            try {
                socket = new WebSocket(overviewWsUrl(projectId, range));
            } catch (err) {
                debugLog("overview ws construct error", err);
                setConnectionState("reconnecting");
                retryTimer = setTimeout(connect, 5000);
                return;
            }

            socket.onopen = () => {
                if (!active) return;
                debugLog("overview ws open", projectId);
                setConnectionState("live");
            };

            socket.onmessage = (event) => {
                if (!active) return;
                try {
                    debugLog("overview ws message", event.data);
                    const message = JSON.parse(event.data as string) as { type?: string; data?: OverviewStats };
                    if (message.type === "overview" && message.data) {
                        setStats(message.data);
                    }
                } catch {
                    // Ignore malformed websocket payloads.
                }
            };

            socket.onclose = (event) => {
                if (!active) return;
                debugLog("overview ws closed", event);
                setConnectionState("reconnecting");
                retryTimer = setTimeout(() => {
                    if (!active) return;
                    connect();
                }, 5000);
            };

            socket.onerror = (ev) => {
                debugLog("overview ws error", ev);
                socket?.close();
            };
        };

        connect();

        return () => {
            active = false;
            if (retryTimer) clearTimeout(retryTimer);
            socket?.close();
        };
    }, [projectId, range]);

    useEffect(() => {
        let active = true;
        let socket: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        let refreshInFlight = false;

        const refreshAnalytics = async () => {
            if (!active || refreshInFlight) return;
            refreshInFlight = true;
            const baseQuery = `project_id=${encodeURIComponent(projectId)}&range=${encodeURIComponent(range)}`;
            try {
                const [nextAnalytics, nextFunnel, nextComparison, nextInsights] = await Promise.all([
                    apiFetch<AnalyticsSummary>(`/dashboard/analytics?${baseQuery}`),
                    apiFetch<FunnelSummary>(`/dashboard/funnel?${baseQuery}&steps=${encodeURIComponent(funnelSteps)}`),
                    apiFetch<PeriodComparison>(`/dashboard/comparison?${baseQuery}`),
                    apiFetch<AutomatedInsight[]>(`/dashboard/insights?${baseQuery}`),
                ]);
                if (!active) return;
                setAnalytics(nextAnalytics);
                setFunnel(nextFunnel);
                setComparisonData(nextComparison);
                setInsightsData(nextInsights);
            } catch (err) {
                debugLog("analytics refresh failed", err);
            } finally {
                refreshInFlight = false;
            }
        };

        const scheduleClientRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                refreshAnalytics();
            }, 1000);
        };

        const connect = () => {
            if (!active) return;
            try {
                socket = new WebSocket(eventsWsUrl(projectId));
            } catch (err) {
                debugLog("analytics events ws construct error", err);
                retryTimer = setTimeout(connect, 5000);
                return;
            }

            socket.onmessage = (event) => {
                if (!active) return;
                try {
                    const message = JSON.parse(event.data as string) as { type?: string };
                    if (message.type === "event.created" || message.type === "event.deleted" || message.type === "events.deleted") {
                        scheduleClientRefresh();
                    }
                } catch {
                    // Ignore malformed websocket payloads.
                }
            };
            socket.onclose = () => {
                if (!active) return;
                retryTimer = setTimeout(connect, 5000);
            };
            socket.onerror = () => socket?.close();
        };

        connect();
        return () => {
            active = false;
            if (retryTimer) clearTimeout(retryTimer);
            if (refreshTimer) clearTimeout(refreshTimer);
            socket?.close();
        };
    }, [projectId, range, funnelSteps]);

    const eventsPath = `/projects/${projectId}/events`;
    const sessionsPath = `/projects/${projectId}/sessions`;
    const eventTypeHref = (eventType: string) => `${eventsPath}?event_type=${encodeURIComponent(eventType)}`;
    const searchHref = (value: string) => `${eventsPath}?search=${encodeURIComponent(value)}`;
    const pageViewsDelta = compare ? comparisonData.page_views.change_percent : undefined;
    const visitorsDelta = compare ? comparisonData.visitors.change_percent : undefined;
    const showSummary = view === "overview";
    const showTraffic = view === "overview" || view === "web";
    const showAudience = view === "audience";
    const showFunnels = view === "funnels";
    const showPerformance = view === "performance";
    const showInsights = view === "overview" || view === "insights";

    return (
        <div className="space-y-6">
            <AnalyticsControlBar projectId={projectId} range={range} compare={compare} steps={funnelStepsText} defaultSteps={defaultFunnelSteps} />

            {showSummary && (
                <>
                    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InsightCard label="Active users" value={stats.active_users} detail={`People with events in ${rangeLabel[range]}`} icon={Users} tone="blue" href={eventsPath} delta={compare ? comparisonData.active_users.change_percent : undefined} />
                            <InsightCard label="New users" value={stats.new_users} detail="First seen during this window" icon={UserPlus} tone="green" href={`/projects/${projectId}/audience`} />
                            <InsightCard label="Online now" value={stats.online_users} detail={`${formatMetric(stats.active_sessions)} active live sessions`} icon={Wifi} href={`/projects/${projectId}/realtime`} />
                            <InsightCard label="Sessions" value={stats.sessions} detail="Unique tracked sessions" icon={Activity} href={sessionsPath} />
                        </div>

                        <div className="rounded-lg border border-border bg-ink p-4 text-white shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase text-white/60">Live feed</div>
                                    <div className="mt-2 text-2xl font-semibold capitalize">{connectionState}</div>
                                </div>
                                <span className="grid h-11 w-11 place-items-center rounded-md bg-white/12">
                                    {connectionState === "live" ? <Radio size={21} aria-hidden="true" /> : <RefreshCw size={21} aria-hidden="true" />}
                                </span>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3 border-y border-white/10 py-3 text-sm">
                                <span className="text-white/70">Websocket {connectionState === "live" ? "connected" : "fallback active"}</span>
                                <Link href={`/projects/${projectId}/realtime`} className="font-medium text-white underline underline-offset-4">Open realtime</Link>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <div><div className="text-xs text-white/60">Events</div><div className="mt-1 text-xl font-semibold">{formatMetric(stats.events)}</div></div>
                                <div className="border-l border-white/10 pl-3"><div className="text-xs text-white/60">Requests</div><div className="mt-1 text-xl font-semibold">{formatMetric(stats.requests)}</div></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <InsightCard label="Errors" value={stats.errors} detail="Captured error events" icon={AlertTriangle} tone={stats.errors ? "red" : "ink"} href={searchHref("error")} />
                        <InsightCard label="Failed jobs" value={stats.failed_jobs} detail="Background jobs needing review" icon={ServerCrash} tone={stats.failed_jobs ? "amber" : "ink"} href={eventTypeHref("job")} />
                        <InsightCard label="Failed webhooks" value={stats.failed_webhooks} detail={`${formatMetric(stats.monitor_down)} monitor checks down`} icon={BarChart3} tone={stats.failed_webhooks || stats.monitor_down ? "amber" : "ink"} href={eventTypeHref("webhook")} />
                    </div>
                </>
            )}

            {compare && (showSummary || view === "insights") && <PeriodComparisonPanel comparison={comparisonData} />}
            {showInsights && <AutomatedInsightsPanel insights={showSummary ? insightsData.slice(0, 3) : insightsData} href={showSummary ? `/projects/${projectId}/insights` : undefined} />}

            {(showTraffic || showAudience || showFunnels || showPerformance) && <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-muted">
                            <Globe2 size={16} aria-hidden="true" />
                            <span>{showAudience ? "Audience analytics" : showFunnels ? "Conversion analytics" : showPerformance ? "Performance analytics" : "Web analytics"}</span>
                        </div>
                        <h2 className="mt-1 text-xl font-semibold text-ink">
                            {showAudience ? "Users, retention, and geography" : showFunnels ? "Funnels and conversion" : showPerformance ? "Core Web Vitals" : "Traffic and acquisition"}
                        </h2>
                    </div>
                    <div className="text-sm text-muted">
                        {formatMetric(analytics.page_views)} page views · {formatMetric(analytics.visitors)} visitors · {formatMetric(analytics.sessions)} sessions
                    </div>
                </div>

                {showTraffic && <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <InsightCard label="Page views" value={analytics.page_views} detail="Bot-filtered views in this window" icon={Globe2} tone="blue" href={eventTypeHref("page_view")} delta={pageViewsDelta} />
                        <InsightCard label="Visitors" value={analytics.visitors} detail="Unique identified or anonymous visitors" icon={Users} tone="green" href={eventsPath} delta={visitorsDelta} />
                        <InsightCard label="Bot traffic" value={analytics.bot_page_views} detail="Excluded from web analytics totals" icon={ShieldCheck} tone={analytics.bot_page_views ? "amber" : "ink"} href={searchHref("bot")} />
                        <InsightCard label="Page sessions" value={analytics.sessions} detail="Sessions with page views" icon={Activity} href={sessionsPath} delta={compare ? comparisonData.sessions.change_percent : undefined} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-ink">Page views over time</div>
                                    <div className="text-sm text-muted">Last {analytics.series.length > 24 ? 24 : analytics.series.length || 0} points in this window</div>
                                </div>
                                <BarChart3 className="h-5 w-5 text-muted" aria-hidden="true" />
                            </div>
                            <MiniTrafficChart series={analytics.series} />
                        </div>
                        <BreakdownList title="Top pages" items={analytics.top_pages} empty="No page view events yet." hrefForItem={(item) => `/projects/${projectId}/pages?path=${encodeURIComponent(item.label)}${range !== "24h" ? `&range=${range}` : ""}`} />
                    </div>
                </>}

                {showPerformance && <WebVitalsPanel vitals={analytics.web_vitals} />}
                {showAudience && <RetentionPanel retention={analytics.retention} />}

                {showFunnels && <FunnelPanel
                    funnel={funnel}
                    stepsText={funnelStepsText}
                    onStepsTextChange={setFunnelStepsText}
                    onApply={() => updateUrl(range, funnelStepsText)}
                />}

                {view === "web" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <BreakdownList title="Traffic channels" items={analytics.traffic_channels} empty="No channel data yet." hrefForItem={(item) => searchHref(item.label)} />
                    <BreakdownList title="Referrers" items={analytics.referrers} empty="No referrer data yet." hrefForItem={(item) => searchHref(item.label)} />
                    <BreakdownList title="UTM sources" items={analytics.utm_sources} empty="No campaign data yet." hrefForItem={(item) => searchHref(item.label)} />
                    <BreakdownList title="Devices" items={analytics.devices} empty="No device data yet." hrefForItem={(item) => searchHref(item.label)} />
                    <BreakdownList title="Browsers" items={analytics.browsers} empty="No browser data yet." hrefForItem={(item) => searchHref(item.label)} />
                </div>}

                {showAudience && <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                            <Flag className="h-4 w-4" aria-hidden="true" />
                            <span>Country analytics</span>
                        </div>
                        <BreakdownList title="Countries" items={analytics.countries} empty="No country data yet. Deploy behind Cloudflare/Vercel or pass geo headers." hrefForItem={(item) => searchHref(item.label)} />
                    </div>
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            <span>City analytics</span>
                        </div>
                        <BreakdownList title="Cities" items={analytics.cities} empty="No city data yet. Deploy behind a proxy that sends geo city headers." hrefForItem={(item) => searchHref(item.label)} />
                    </div>
                </div>}
            </section>}

            {showAudience && <div id="presence">
                <PresencePanel projectId={projectId} initialPresence={initialPresence} />
            </div>}
        </div>
    );
}
