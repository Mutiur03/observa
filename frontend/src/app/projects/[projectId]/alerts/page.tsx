import { AppShell } from "@/components/AppShell";
import { AlertsPanel, type AlertRuleRow } from "@/components/AlertsPanel";
import { serverApiFetch } from "@/lib/server-api";

export default async function AlertsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const rows = await serverApiFetch<AlertRuleRow[]>(`/alerts?project_id=${projectId}`);
  return (
    <AppShell projectId={projectId}>
      <AlertsPanel projectId={projectId} initialRows={rows} />
    </AppShell>
  );
}
