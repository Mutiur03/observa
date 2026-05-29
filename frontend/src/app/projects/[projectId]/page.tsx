import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { serverApiFetch } from "@/lib/server-api";
import type { OverviewStats } from "@/types";

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const stats = await serverApiFetch<OverviewStats>(`/dashboard/overview?project_id=${projectId}`);

  return (
    <AppShell projectId={projectId}>
      <h1 className="mb-5 text-2xl font-semibold">Project Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Events" value={stats.events} />
        <MetricCard label="Errors" value={stats.errors} />
        <MetricCard label="API Requests" value={stats.requests} />
        <MetricCard label="Sessions" value={stats.sessions} />
        <MetricCard label="Failed Jobs" value={stats.failed_jobs} />
        <MetricCard label="Failed Webhooks" value={stats.failed_webhooks} />
        <MetricCard label="Monitor Down" value={stats.monitor_down} />
      </div>
    </AppShell>
  );
}
