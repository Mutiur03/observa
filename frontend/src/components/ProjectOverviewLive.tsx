"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Clock, Radio, RefreshCw, ServerCrash, Users, UserPlus, Wifi } from "lucide-react";

import { PresencePanel } from "@/components/PresencePanel";
import { apiFetch } from "@/lib/api";
import type { OverviewStats, PresenceSnapshot } from "@/types";

type ConnectionState = "connecting" | "live" | "reconnecting";
type OverviewRange = "24h" | "7d" | "30d" | "90d" | "all";
type MetricTone = "ink" | "blue" | "green" | "red" | "amber";

const overviewRanges: { value: OverviewRange; label: string; caption: string }[] = [
    { value: "24h", label: "24h", caption: "Today" },
    { value: "7d", label: "7d", caption: "Week" },
    { value: "30d", label: "30d", caption: "Month" },
    { value: "90d", label: "90d", caption: "Quarter" },
    { value: "all", label: "All", caption: "Lifetime" },
];

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

function formatMetric(value: number | string) {
    return typeof value === "number" ? value.toLocaleString() : value;
}

function InsightCard({
    label,
    value,
    detail,
    icon: Icon,
    tone = "ink",
}: {
    label: string;
    value: number | string;
    detail: string;
    icon: typeof Users;
    tone?: MetricTone;
}) {
    const classes = toneClass[tone];
    return (
        <div className={`relative overflow-hidden rounded-lg border p-4 shadow-sm ${classes.card}`}>
            <div className={`absolute inset-x-0 top-0 h-1 ${classes.accent}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase text-muted">{label}</div>
                    <div className="mt-2 text-3xl font-semibold leading-none text-ink">{formatMetric(value)}</div>
                    <div className="mt-2 text-sm text-muted">{detail}</div>
                </div>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${classes.icon}`}>
                    <Icon size={20} aria-hidden="true" />
                </span>
            </div>
        </div>
    );
}

export function ProjectOverviewLive({ projectId, initialStats, initialPresence }: { projectId: string; initialStats: OverviewStats; initialPresence: PresenceSnapshot }) {
    const [stats, setStats] = useState(initialStats);
    const [range, setRange] = useState<OverviewRange>("24h");
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

    useEffect(() => {
        let active = true;
        let socket: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let pollTimer: ReturnType<typeof setInterval> | undefined;

        const startPolling = () => {
            if (pollTimer) return;
            debugLog("overview polling start", projectId);
            setConnectionState("reconnecting");
            pollTimer = setInterval(async () => {
                try {
                    const fresh = await apiFetch<OverviewStats>(`/dashboard/overview?${overviewQuery(projectId, range)}`);
                    if (!active) return;
                    setStats(fresh);
                } catch (err) {
                    debugLog("overview polling error", err);
                }
            }, 2000);
        };

        const stopPolling = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = undefined;
            }
        };

        const connect = () => {
            if (!active) return;
            setConnectionState((current) => (current === "live" ? current : "connecting"));
            try {
                socket = new WebSocket(overviewWsUrl(projectId, range));
            } catch (err) {
                debugLog("overview ws construct error", err);
                startPolling();
                return;
            }

            socket.onopen = () => {
                if (!active) return;
                debugLog("overview ws open", projectId);
                setConnectionState("live");
                stopPolling();
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
                // fallback to polling when ws not available or auth blocked
                startPolling();
                // try reconnecting websocket later
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
            stopPolling();
            socket?.close();
        };
    }, [projectId, range]);

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-muted">
                            <Clock size={16} aria-hidden="true" />
                            <span>Reporting window</span>
                        </div>
                        <div className="mt-1 text-xl font-semibold text-ink">User activity for {rangeLabel[range]}</div>
                    </div>
                    <div className="grid grid-cols-5 rounded-lg border border-border bg-surface-muted p-1">
                        {overviewRanges.map((option) => (
                            <button
                                key={option.value}
                                className={`min-w-0 rounded-md px-3 py-2 text-center transition ${
                                    range === option.value
                                        ? "bg-brand text-white shadow-sm"
                                        : "text-muted hover:bg-surface hover:text-ink"
                                }`}
                                onClick={() => setRange(option.value)}
                                type="button"
                            >
                                <span className="block text-sm font-semibold leading-tight">{option.label}</span>
                                <span className="hidden text-xs leading-tight sm:block">{option.caption}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="grid gap-4 sm:grid-cols-2">
                    <InsightCard label="Active users" value={stats.active_users} detail={`People with events in ${rangeLabel[range]}`} icon={Users} tone="blue" />
                    <InsightCard label="New users" value={stats.new_users} detail="First seen during this window" icon={UserPlus} tone="green" />
                    <InsightCard label="Online now" value={stats.online_users} detail={`${formatMetric(stats.active_sessions)} active live sessions`} icon={Wifi} />
                    <InsightCard label="Sessions" value={stats.sessions} detail="Tracked session events" icon={Activity} />
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
                        <span className="font-medium text-white">Refresh 2s</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <div>
                            <div className="text-xs text-white/60">Events</div>
                            <div className="mt-1 text-xl font-semibold">{formatMetric(stats.events)}</div>
                        </div>
                        <div className="border-l border-white/10 pl-3">
                            <div className="text-xs text-white/60">Requests</div>
                            <div className="mt-1 text-xl font-semibold">{formatMetric(stats.requests)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <InsightCard label="Errors" value={stats.errors} detail="Captured error events" icon={AlertTriangle} tone={stats.errors ? "red" : "ink"} />
                <InsightCard label="Failed jobs" value={stats.failed_jobs} detail="Background jobs needing review" icon={ServerCrash} tone={stats.failed_jobs ? "amber" : "ink"} />
                <InsightCard label="Failed webhooks" value={stats.failed_webhooks} detail={`${formatMetric(stats.monitor_down)} monitor checks down`} icon={BarChart3} tone={stats.failed_webhooks || stats.monitor_down ? "amber" : "ink"} />
            </div>

            <PresencePanel projectId={projectId} initialPresence={initialPresence} />
        </div>
    );
}
