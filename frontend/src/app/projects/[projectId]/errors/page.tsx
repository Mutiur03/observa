import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await serverApiFetch<{ items: EventRow[] }>(`/dashboard/errors?project_id=${projectId}`);
  return <EventTablePage rows={data.items} title="Errors" currentType="" basePath={`/projects/${projectId}/errors`} projectId={projectId} />;
}
