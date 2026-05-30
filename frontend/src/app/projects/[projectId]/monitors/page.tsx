import { MonitorsPanel, type MonitorRow } from "@/components/MonitorsPanel";
import { serverApiFetch } from "@/lib/server-api";

export default async function MonitorsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const rows = await serverApiFetch<MonitorRow[]>(`/monitors?project_id=${projectId}`);
  return <MonitorsPanel projectId={projectId} initialRows={rows} />;
}
