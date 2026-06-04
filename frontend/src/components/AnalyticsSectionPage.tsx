import { ProjectOverviewLive, type AnalyticsView } from "@/components/ProjectOverviewLive";
import { serverApiFetch } from "@/lib/server-api";
import type { AnalyticsSummary, AutomatedInsight, FunnelSummary, OverviewStats, PeriodComparison, PresenceSnapshot } from "@/types";

type OverviewRange = "24h" | "7d" | "30d" | "90d" | "all";

const ranges = new Set(["24h", "7d", "30d", "90d", "all"]);
const defaultFunnelSteps = "page_view:*,custom_event:sign_up,custom_event:purchase";
const emptyPresence: PresenceSnapshot = { online_users: 0, identified_users: 0, anonymous_users: 0, active_sessions: 0, visitors: [] };

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function AnalyticsSectionPage({
  projectId,
  searchParams,
  view,
  title,
  description,
}: {
  projectId: string;
  searchParams: { range?: string | string[]; steps?: string | string[]; compare?: string | string[] };
  view: AnalyticsView;
  title: string;
  description: string;
}) {
  const rawRange = valueOf(searchParams.range);
  const range = (ranges.has(rawRange ?? "") ? rawRange : "24h") as OverviewRange;
  const funnelSteps = valueOf(searchParams.steps)?.trim() || defaultFunnelSteps;
  const compare = valueOf(searchParams.compare) === "1";
  const baseQuery = `project_id=${encodeURIComponent(projectId)}&range=${encodeURIComponent(range)}`;
  const [stats, analytics, funnel, presence, comparison, insights] = await Promise.all([
    serverApiFetch<OverviewStats>(`/dashboard/overview?${baseQuery}`),
    serverApiFetch<AnalyticsSummary>(`/dashboard/analytics?${baseQuery}`),
    serverApiFetch<FunnelSummary>(`/dashboard/funnel?${baseQuery}&steps=${encodeURIComponent(funnelSteps)}`),
    serverApiFetch<PresenceSnapshot>(`/dashboard/presence?project_id=${projectId}`).catch(() => emptyPresence),
    serverApiFetch<PeriodComparison>(`/dashboard/comparison?${baseQuery}`),
    serverApiFetch<AutomatedInsight[]>(`/dashboard/insights?${baseQuery}`),
  ]);

  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Analytics</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <ProjectOverviewLive
        projectId={projectId}
        initialStats={stats}
        initialAnalytics={analytics}
        initialFunnel={funnel}
        initialPresence={presence}
        range={range}
        funnelSteps={funnelSteps}
        compare={compare}
        comparison={comparison}
        insights={insights}
        view={view}
      />
    </>
  );
}
