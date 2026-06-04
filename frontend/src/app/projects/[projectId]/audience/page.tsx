import { AnalyticsSectionPage } from "@/components/AnalyticsSectionPage";

export default async function AudiencePage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  return <AnalyticsSectionPage projectId={projectId} searchParams={await searchParams} view="audience" title="Audience" description="Retention, active users, geographic distribution, and visitors currently online." />;
}
