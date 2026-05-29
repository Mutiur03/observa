"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { apiFetch } from "@/lib/api";
import type { OverviewStats } from "@/types";

export default function ProjectOverview({ params }: { params: { projectId: string } }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<OverviewStats>(`/dashboard/overview?project_id=${params.projectId}`)
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [params.projectId]);

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-semibold">Project Overview</h1>
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!stats ? (
        <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">Loading overview...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Events" value={stats.events} />
          <MetricCard label="Errors" value={stats.errors} />
          <MetricCard label="API Requests" value={stats.requests} />
          <MetricCard label="Sessions" value={stats.sessions} />
          <MetricCard label="Failed Jobs" value={stats.failed_jobs} />
          <MetricCard label="Failed Webhooks" value={stats.failed_webhooks} />
          <MetricCard label="Monitor Down" value={stats.monitor_down} />
        </div>
      )}
    </AppShell>
  );
}
