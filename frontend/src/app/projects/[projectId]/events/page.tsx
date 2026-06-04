import { EventTablePage } from "@/components/EventTablePage";
import { serverApiFetch } from "@/lib/server-api";
import type { EventRow } from "@/types";

type PageData<T> = { items: T[]; total: number; page: number; page_size: number };

function numberParam(value: string | string[] | undefined, fallback: number, min: number, max: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ event_type?: string; anonymous_id?: string; trace_id?: string; user_id?: string; session_id?: string; search?: string; page?: string; page_size?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const { event_type = "", anonymous_id = "", trace_id = "", user_id = "", session_id = "", search = "" } = query;
  const page = numberParam(query.page, 1, 1, 100000);
  const pageSize = numberParam(query.page_size, 25, 10, 100);
  const data = await serverApiFetch<PageData<EventRow>>(
    `/dashboard/events?project_id=${projectId}&page=${page}&page_size=${pageSize}${event_type ? `&event_type=${encodeURIComponent(event_type)}` : ""}${anonymous_id ? `&anonymous_id=${encodeURIComponent(anonymous_id)}` : ""}${trace_id ? `&trace_id=${encodeURIComponent(trace_id)}` : ""}${user_id ? `&user_id=${encodeURIComponent(user_id)}` : ""}${session_id ? `&session_id=${encodeURIComponent(session_id)}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
  );
  return <EventTablePage rows={data.items} total={data.total} page={data.page} pageSize={data.page_size} title="Events" filters={{ event_type, anonymous_id, trace_id, user_id, session_id }} initialSearch={search} syncSearchToUrl basePath={`/projects/${projectId}/events`} projectId={projectId} />;
}
