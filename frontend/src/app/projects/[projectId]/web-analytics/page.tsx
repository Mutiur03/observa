import { AnalyticsSectionPage } from "@/components/AnalyticsSectionPage";

export default async function WebAnalyticsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await params;
  return <AnalyticsSectionPage projectId={projectId} searchParams={await searchParams} view="web" title="Web Analytics" description="Traffic, pages, acquisition channels, campaigns, devices, browsers, and bot activity." />;
}
