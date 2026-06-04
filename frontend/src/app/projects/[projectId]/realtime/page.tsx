import { RealtimeAnalyticsLive } from "@/components/RealtimeAnalyticsLive";
import { serverApiFetch } from "@/lib/server-api";
import type { AnalyticsSummary, AutomatedInsight, EventRow, FunnelSummary, OverviewStats, PeriodComparison, PresenceSnapshot } from "@/types";

type PageData<T> = { items: T[]; total: number; page: number; page_size: number };

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

export default async function RealtimePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [bundle, events] = await Promise.all([
    serverApiFetch<DashboardBundle>(
      `/dashboard/bundle?project_id=${projectId}&range=24h`,
      { next: { revalidate: 2 } },
    ),
    serverApiFetch<PageData<EventRow>>(
      `/dashboard/events?project_id=${projectId}&page=1&page_size=50`,
      { next: { revalidate: 2 } },
    ),
  ]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Realtime analytics</p>
          <h1 className="mt-1 text-2xl font-semibold">Live Activity</h1>
        </div>
        <p className="text-sm text-muted">Users, sessions, page views, and events as they happen.</p>
      </div>
      <RealtimeAnalyticsLive
        projectId={projectId}
        initialStats={bundle.stats}
        initialAnalytics={bundle.analytics}
        initialPresence={bundle.presence ?? emptyPresence}
        initialEvents={events.items}
      />
    </>
  );
}
