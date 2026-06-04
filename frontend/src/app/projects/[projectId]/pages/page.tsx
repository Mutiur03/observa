import { redirect } from "next/navigation";

import { PageDetailView } from "@/components/PageDetailView";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow, PageDetailSummary } from "@/types";

type OverviewRange = "24h" | "7d" | "30d" | "90d" | "all";
type PageData<T> = { items: T[]; total: number; page: number; page_size: number };

const ranges = new Set(["24h", "7d", "30d", "90d", "all"]);

function normalizeRange(value: string | string[] | undefined): OverviewRange {
  const range = Array.isArray(value) ? value[0] : value;
  return ranges.has(range ?? "") ? range as OverviewRange : "24h";
}

export default async function PagesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ path?: string | string[]; range?: string | string[] }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const path = (Array.isArray(query.path) ? query.path[0] : query.path)?.trim();
  const range = normalizeRange(query.range);

  if (!path) {
    redirect(`/projects/${projectId}`);
  }

  const encodedPath = encodeURIComponent(path);
  const [detail, events] = await Promise.all([
    serverApiFetch<PageDetailSummary>(`/dashboard/page-detail?project_id=${projectId}&path=${encodedPath}&range=${range}`),
    serverApiFetch<PageData<EventRow>>(`/dashboard/events?project_id=${projectId}&search=${encodedPath}&page=1&page_size=10`),
  ]);

  return <PageDetailView projectId={projectId} range={range} detail={detail} events={events.items} />;
}
