import { UserProfileView } from "@/components/UserProfileView";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow, UserProfileSummary } from "@/types";

export default async function TimelinePage({ params }: { params: Promise<{ projectId: string; userId: string }> }) {
  const { projectId, userId } = await params;
  const [profile, data] = await Promise.all([
    serverApiFetch<UserProfileSummary>(`/dashboard/users/${encodeURIComponent(userId)}/profile?project_id=${projectId}`),
    serverApiFetch<{ items: EventRow[] }>(`/dashboard/events?project_id=${projectId}&user_id=${encodeURIComponent(userId)}&page_size=100`),
  ]);
  return <UserProfileView projectId={projectId} profile={profile} events={data.items} />;
}
