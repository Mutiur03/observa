"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, GitCompare, Search, SlidersHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

export type AnalyticsRange = "24h" | "7d" | "30d" | "90d" | "all";

const ranges: { value: AnalyticsRange; label: string; caption: string }[] = [
  { value: "24h", label: "24h", caption: "Today" },
  { value: "7d", label: "7d", caption: "Week" },
  { value: "30d", label: "30d", caption: "Month" },
  { value: "90d", label: "90d", caption: "Quarter" },
  { value: "all", label: "All", caption: "Lifetime" },
];

export function AnalyticsControlBar({
  projectId,
  range,
  compare,
  steps,
  defaultSteps,
}: {
  projectId: string;
  range: AnalyticsRange;
  compare: boolean;
  steps?: string;
  defaultSteps?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const updateUrl = (next: { range?: AnalyticsRange; compare?: boolean }) => {
    const params = new URLSearchParams();
    const nextRange = next.range ?? range;
    const nextCompare = next.compare ?? compare;
    if (nextRange !== "24h") params.set("range", nextRange);
    if (nextCompare) params.set("compare", "1");
    if (steps && steps !== defaultSteps) params.set("steps", steps);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = search.trim();
    if (!value) return;
    router.push(`/projects/${projectId}/events?search=${encodeURIComponent(value)}`);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Analytics controls</span>
          </div>
          <form onSubmit={submitSearch} className="mt-2 flex min-w-0 overflow-hidden rounded-md border border-border bg-canvas focus-within:border-ink">
            <span className="grid w-10 shrink-0 place-items-center text-muted">
              <Search size={16} aria-hidden="true" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search page, user, session, referrer, country..."
              className="min-w-0 flex-1 bg-transparent px-0 py-2 text-sm outline-none"
            />
            <button type="submit" className="shrink-0 border-l border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted">
              Search
            </button>
          </form>
        </div>

        <div className="grid grid-cols-5 rounded-lg border border-border bg-surface-muted p-1">
          {ranges.map((option) => (
            <button
              key={option.value}
              className={`min-w-0 rounded-md px-3 py-2 text-center transition ${
                range === option.value ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface hover:text-ink"
              }`}
              onClick={() => updateUrl({ range: option.value })}
              type="button"
            >
              <span className="block text-sm font-semibold leading-tight">{option.label}</span>
              <span className="hidden text-xs leading-tight sm:block">{option.caption}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <button
            type="button"
            onClick={() => updateUrl({ compare: !compare })}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
              compare ? "border-ink bg-ink text-white" : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            <GitCompare size={16} aria-hidden="true" />
            Compare
          </button>
          <Link
            href={`/projects/${projectId}/events`}
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            <CalendarDays size={16} aria-hidden="true" />
            Events
          </Link>
        </div>
      </div>
    </div>
  );
}
