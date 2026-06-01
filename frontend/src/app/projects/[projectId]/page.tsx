import { ProjectOverviewLive } from "@/components/ProjectOverviewLive";
import { serverApiFetch } from "@/lib/server-api";
import type { OverviewStats, PresenceSnapshot } from "@/types";

const emptyPresence: PresenceSnapshot = {
  online_users: 0,
  identified_users: 0,
  anonymous_users: 0,
  active_sessions: 0,
  visitors: [],
};

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const stats = await serverApiFetch<OverviewStats>(`/dashboard/overview?project_id=${projectId}`);
  const presence = await serverApiFetch<PresenceSnapshot>(`/dashboard/presence?project_id=${projectId}`).catch(() => emptyPresence);

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Project Overview</h1>
      <ProjectOverviewLive projectId={projectId} initialStats={stats} initialPresence={presence} />
    </>
  );
}
