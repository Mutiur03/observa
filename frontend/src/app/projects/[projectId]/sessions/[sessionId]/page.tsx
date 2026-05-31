import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const { projectId, sessionId } = await params;
  const data = await serverApiFetch<{ items: EventRow[] }>(`/dashboard/events?project_id=${projectId}&session_id=${sessionId}`);
  return <EventTablePage rows={data.items} title={`Session ${sessionId}`} basePath={`/projects/${projectId}/sessions/${sessionId}`} projectId={projectId} filters={{ session_id: sessionId }} showTypeFilters={false} description="Live events captured inside this session." />;
}
