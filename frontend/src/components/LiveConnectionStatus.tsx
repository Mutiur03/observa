import { Activity, Gauge, WifiOff } from "lucide-react";

type ConnectionState = "connecting" | "live" | "reconnecting";

function getStatusText(state: ConnectionState, label: string) {
    if (state === "live") return `${label} connected`;
    if (state === "connecting") return `Connecting to ${label.toLowerCase()}`;
    return `Reconnecting ${label.toLowerCase()}`;
}

export function LiveConnectionStatus({
    state,
    label,
    refreshLabel,
}: {
    state: ConnectionState;
    label: string;
    refreshLabel: string;
}) {
    const live = state === "live";

    return (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 text-sm shadow-sm md:flex-row md:items-center md:justify-between">
            <span className="flex items-center gap-2 text-ink">
                {live ? <Activity className="h-4 w-4 text-brand" /> : <WifiOff className="h-4 w-4 text-muted" />}
                <span className="font-medium">{getStatusText(state, label)}</span>
            </span>
            <span className="flex items-center gap-2 text-muted">
                <Gauge className="h-4 w-4" />
                {refreshLabel}
            </span>
        </div>
    );
}