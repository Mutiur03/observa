import { SessionsTableLive } from "@/components/SessionsTableLive";
import { serverApiFetch } from "@/lib/server-api";
import type { SessionSummaryRow } from "@/types";

type PageData<T> = { items: T[]; total: number; page: number; page_size: number };

type RawSessionRow = {
  session_id?: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  event_count?: number;
  first_seen?: string;
  last_seen?: string;
  timestamp?: string;
};

function numberParam(value: string | string[] | undefined, fallback: number, min: number, max: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeSessions(rows: RawSessionRow[]): SessionSummaryRow[] {
  const grouped = new Map<string, SessionSummaryRow>();

  for (const row of rows) {
    if (!row.session_id) continue;

    const timestamp = row.timestamp ?? row.first_seen ?? row.last_seen ?? new Date().toISOString();
    const existing = grouped.get(row.session_id);

    if (!existing) {
      grouped.set(row.session_id, {
        session_id: row.session_id,
        user_id: row.user_id ?? null,
        anonymous_id: row.anonymous_id ?? null,
        event_count: row.event_count ?? 1,
        first_seen: row.first_seen ?? timestamp,
        last_seen: row.last_seen ?? timestamp,
      });
      continue;
    }

    const firstSeen = new Date(existing.first_seen).getTime();
    const lastSeen = new Date(existing.last_seen).getTime();
    const nextSeen = new Date(timestamp).getTime();

    grouped.set(row.session_id, {
      ...existing,
      user_id: existing.user_id ?? row.user_id ?? null,
      anonymous_id: existing.anonymous_id ?? row.anonymous_id ?? null,
      event_count: existing.event_count + (row.event_count ?? 1),
      first_seen: Number.isNaN(firstSeen) || nextSeen < firstSeen ? timestamp : existing.first_seen,
      last_seen: Number.isNaN(lastSeen) || nextSeen > lastSeen ? timestamp : existing.last_seen,
    });
  }

  return Array.from(grouped.values()).sort(
    (left, right) => new Date(right.last_seen).getTime() - new Date(left.last_seen).getTime(),
  );
}

export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; page_size?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const page = numberParam(query.page, 1, 1, 100000);
  const pageSize = numberParam(query.page_size, 25, 10, 100);
  const data = await serverApiFetch<PageData<RawSessionRow>>(
    `/dashboard/sessions?project_id=${projectId}&page=${page}&page_size=${pageSize}`,
    { next: { revalidate: 2 } },
  );
  const sessions = normalizeSessions(data.items);

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Project activity</p>
          <h1 className="mt-1 text-2xl font-semibold">Sessions</h1>
        </div>
        <p className="text-sm text-muted">Open a session to see every event collected inside it.</p>
      </div>

      <SessionsTableLive projectId={projectId} initialRows={sessions} total={data.total} page={data.page} pageSize={data.page_size} />
    </>
  );
}
