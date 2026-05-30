import { ProjectOverviewLive } from "@/components/ProjectOverviewLive";
import { serverApiFetch } from "@/lib/server-api";
import type { OverviewStats } from "@/types";

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const stats = await serverApiFetch<OverviewStats>(`/dashboard/overview?project_id=${projectId}`);

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Project Overview</h1>
      <ProjectOverviewLive projectId={projectId} initialStats={stats} />
    </>
  );
}
