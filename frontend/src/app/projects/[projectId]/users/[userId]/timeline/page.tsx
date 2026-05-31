import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function TimelinePage({ params }: { params: Promise<{ projectId: string; userId: string }> }) {
  const { projectId, userId } = await params;
  const data = await serverApiFetch<{ items: EventRow[] }>(`/dashboard/events?project_id=${projectId}&user_id=${encodeURIComponent(userId)}`);
  return <EventTablePage rows={data.items} title={`User ${userId}`} basePath={`/projects/${projectId}/users/${userId}/timeline`} projectId={projectId} filters={{ user_id: userId }} showTypeFilters={false} description="Live timeline for this identified user." />;
}
