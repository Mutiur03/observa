"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/MetricCard";
import { LiveConnectionStatus } from "@/components/LiveConnectionStatus";
import { apiFetch } from "@/lib/api";
import type { OverviewStats } from "@/types";

type ConnectionState = "connecting" | "live" | "reconnecting";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE_URL = API_BASE_URL.replace(/^http/i, "ws");

function overviewWsUrl(projectId: string) {
    return `${WS_BASE_URL}/dashboard/overview/ws?project_id=${encodeURIComponent(projectId)}`;
}

export function ProjectOverviewLive({ projectId, initialStats }: { projectId: string; initialStats: OverviewStats }) {
    const [stats, setStats] = useState(initialStats);
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

    useEffect(() => {
        let active = true;
        let socket: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let pollTimer: ReturnType<typeof setInterval> | undefined;

        const startPolling = () => {
            if (pollTimer) return;
            console.debug("overview polling start", projectId);
            setConnectionState("reconnecting");
            pollTimer = setInterval(async () => {
                try {
                    const fresh = await apiFetch<OverviewStats>(`/dashboard/overview?project_id=${encodeURIComponent(projectId)}`);
                    if (!active) return;
                    setStats(fresh);
                } catch (err) {
                    console.debug("overview polling error", err);
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
                socket = new WebSocket(overviewWsUrl(projectId));
            } catch (err) {
                console.debug("overview ws construct error", err);
                startPolling();
                return;
            }

            socket.onopen = () => {
                if (!active) return;
                console.debug("overview ws open", projectId);
                setConnectionState("live");
                stopPolling();
            };

            socket.onmessage = (event) => {
                if (!active) return;
                try {
                    console.debug("overview ws message", event.data);
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
                console.debug("overview ws closed", event);
                // fallback to polling when ws not available or auth blocked
                startPolling();
                // try reconnecting websocket later
                retryTimer = setTimeout(() => {
                    if (!active) return;
                    connect();
                }, 5000);
            };

            socket.onerror = (ev) => {
                console.debug("overview ws error", ev);
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
    }, [projectId]);

    return (
        <>
            <LiveConnectionStatus state={connectionState} label="Websocket" refreshLabel="Auto-refresh every 2s" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Events" value={stats.events} />
                <MetricCard label="Errors" value={stats.errors} />
                <MetricCard label="API Requests" value={stats.requests} />
                <MetricCard label="Sessions" value={stats.sessions} />
                <MetricCard label="Failed Jobs" value={stats.failed_jobs} />
                <MetricCard label="Failed Webhooks" value={stats.failed_webhooks} />
                <MetricCard label="Monitor Down" value={stats.monitor_down} />
                <MetricCard label="Feed" value={connectionState} />
            </div>
        </>
    );
}
