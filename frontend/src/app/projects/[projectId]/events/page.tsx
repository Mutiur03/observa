import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ event_type?: string; anonymous_id?: string; trace_id?: string; user_id?: string; session_id?: string }>;
}) {
  const { projectId } = await params;
  const { event_type = "", anonymous_id = "", trace_id = "", user_id = "", session_id = "" } = await searchParams;
  const data = await serverApiFetch<{ items: EventRow[] }>(
    `/dashboard/events?project_id=${projectId}${event_type ? `&event_type=${encodeURIComponent(event_type)}` : ""}${anonymous_id ? `&anonymous_id=${encodeURIComponent(anonymous_id)}` : ""}${trace_id ? `&trace_id=${encodeURIComponent(trace_id)}` : ""}${user_id ? `&user_id=${encodeURIComponent(user_id)}` : ""}${session_id ? `&session_id=${encodeURIComponent(session_id)}` : ""}`,
  );
  return <EventTablePage rows={data.items} title="Events" filters={{ event_type, anonymous_id, trace_id, user_id, session_id }} basePath={`/projects/${projectId}/events`} projectId={projectId} />;
}
