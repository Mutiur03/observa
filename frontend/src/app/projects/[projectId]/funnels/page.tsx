import { AnalyticsSectionPage } from "@/components/AnalyticsSectionPage";

export default async function FunnelsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  return <AnalyticsSectionPage projectId={projectId} searchParams={await searchParams} view="funnels" title="Funnels" description="Build ordered conversion funnels and identify where users drop off." />;
}
