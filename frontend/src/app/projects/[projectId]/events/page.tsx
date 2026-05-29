import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ event_type?: string }>;
}) {
  const { projectId } = await params;
  const { event_type = "" } = await searchParams;
  const data = await serverApiFetch<{ items: EventRow[] }>(
    `/dashboard/events?project_id=${projectId}${event_type ? `&event_type=${event_type}` : ""}`,
  );
  return <EventTablePage rows={data.items} title="Events" currentType={event_type} basePath={`/projects/${projectId}/events`} projectId={projectId} />;
}
