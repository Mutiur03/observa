import { AnalyticsSectionPage } from "@/components/AnalyticsSectionPage";

export default async function InsightsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  return <AnalyticsSectionPage projectId={projectId} searchParams={await searchParams} view="insights" title="Insights" description="Automated traffic, error, conversion, and performance anomaly detection." />;
}
