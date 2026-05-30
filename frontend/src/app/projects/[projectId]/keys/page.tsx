import { ApiKeysPanel, type ApiKeyRow } from "@/components/ApiKeysPanel";
import { serverApiFetch } from "@/lib/server-api";

export default async function KeysPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const keys = await serverApiFetch<ApiKeyRow[]>(`/projects/${projectId}/api-keys`);
  return <ApiKeysPanel projectId={projectId} initialKeys={keys} />;
}
