import { AlertsPanel, type AlertRuleRow } from "@/components/AlertsPanel";
import { serverApiFetch } from "@/lib/server-api";

export default async function AlertsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const rows = await serverApiFetch<AlertRuleRow[]>(`/alerts?project_id=${projectId}`, { next: { revalidate: 30 } });
  return <AlertsPanel projectId={projectId} initialRows={rows} />;
}
