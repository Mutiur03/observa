import { ProjectOverviewLive } from "@/components/ProjectOverviewLive";
import { serverApiFetch } from "@/lib/server-api";
import type { AnalyticsSummary, AutomatedInsight, FunnelSummary, OverviewStats, PeriodComparison, PresenceSnapshot } from "@/types";

type OverviewRange = "24h" | "7d" | "30d" | "90d" | "all";

const ranges = new Set(["24h", "7d", "30d", "90d", "all"]);
const defaultFunnelSteps = "page_view:*,custom_event:sign_up,custom_event:purchase";

const emptyPresence: PresenceSnapshot = {
  online_users: 0,
  identified_users: 0,
  anonymous_users: 0,
  active_sessions: 0,
  visitors: [],
};

type DashboardBundle = {
  stats: OverviewStats;
  analytics: AnalyticsSummary;
  funnel: FunnelSummary;
  presence: PresenceSnapshot;
  comparison: PeriodComparison;
  insights: AutomatedInsight[];
};

function normalizeRange(value: string | string[] | undefined): OverviewRange {
  const range = Array.isArray(value) ? value[0] : value;
  return ranges.has(range ?? "") ? range as OverviewRange : "24h";
}

function normalizeSteps(value: string | string[] | undefined) {
  const steps = Array.isArray(value) ? value[0] : value;
  return steps?.trim() || defaultFunnelSteps;
}

export default async function ProjectOverview({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string | string[]; steps?: string | string[]; compare?: string | string[] }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = normalizeRange(query.range);
  const funnelSteps = normalizeSteps(query.steps);
  const compare = (Array.isArray(query.compare) ? query.compare[0] : query.compare) === "1";
  const baseQuery = `project_id=${encodeURIComponent(projectId)}&range=${encodeURIComponent(range)}`;

  const bundle = await serverApiFetch<DashboardBundle>(
    `/dashboard/bundle?${baseQuery}&steps=${encodeURIComponent(funnelSteps)}`,
    { next: { revalidate: 2 } },
  );

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Project Overview</h1>
      <ProjectOverviewLive
        projectId={projectId}
        initialStats={bundle.stats}
        initialAnalytics={bundle.analytics}
        initialFunnel={bundle.funnel}
        initialPresence={bundle.presence ?? emptyPresence}
        range={range}
        funnelSteps={funnelSteps}
        compare={compare}
        comparison={bundle.comparison}
        insights={bundle.insights}
      />
    </>
  );
}
