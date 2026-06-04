import { AnalyticsSectionPage } from "@/components/AnalyticsSectionPage";

export default async function PerformancePage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  return <AnalyticsSectionPage projectId={projectId} searchParams={await searchParams} view="performance" title="Performance" description="Core Web Vitals and user-experience performance signals." />;
}
