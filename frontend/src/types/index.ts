export type Project = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type OverviewStats = {
  time_range: string;
  online_users: number;
  active_sessions: number;
  active_users: number;
  new_users: number;
  events: number;
  errors: number;
  requests: number;
  sessions: number;
  failed_jobs: number;
  failed_webhooks: number;
  monitor_down: number;
};

export type AnalyticsBreakdownItem = {
  label: string;
  count: number;
};

export type AnalyticsSeriesPoint = {
  timestamp: string;
  page_views: number;
  visitors: number;
};

export type WebVitalMetric = {
  name: string;
  average: number;
  p75: number;
  count: number;
};

export type RetentionPoint = {
  date: string;
  active_users: number;
  new_users: number;
  returning_users: number;
};

export type FunnelStepMetric = {
  label: string;
  event_type: string;
  event_name?: string | null;
  users: number;
  conversion_rate: number;
  dropoff_rate: number;
};

export type FunnelSummary = {
  time_range: string;
  total_users: number;
  steps: FunnelStepMetric[];
};

export type AnalyticsSummary = {
  time_range: string;
  page_views: number;
  visitors: number;
  sessions: number;
  bot_page_views: number;
  top_pages: AnalyticsBreakdownItem[];
  referrers: AnalyticsBreakdownItem[];
  utm_sources: AnalyticsBreakdownItem[];
  traffic_channels: AnalyticsBreakdownItem[];
  countries: AnalyticsBreakdownItem[];
  cities: AnalyticsBreakdownItem[];
  devices: AnalyticsBreakdownItem[];
  browsers: AnalyticsBreakdownItem[];
  web_vitals: WebVitalMetric[];
  retention: RetentionPoint[];
  series: AnalyticsSeriesPoint[];
};

export type PageDetailSummary = {
  time_range: string;
  path: string;
  page_views: number;
  visitors: number;
  sessions: number;
  events: number;
  errors: number;
  referrers: AnalyticsBreakdownItem[];
  countries: AnalyticsBreakdownItem[];
  cities: AnalyticsBreakdownItem[];
  devices: AnalyticsBreakdownItem[];
  browsers: AnalyticsBreakdownItem[];
  web_vitals: WebVitalMetric[];
  series: AnalyticsSeriesPoint[];
};

export type ComparisonMetric = {
  current: number;
  previous: number;
  change_percent: number;
};

export type PeriodComparison = {
  time_range: string;
  page_views: ComparisonMetric;
  visitors: ComparisonMetric;
  sessions: ComparisonMetric;
  active_users: ComparisonMetric;
  events: ComparisonMetric;
  errors: ComparisonMetric;
};

export type AutomatedInsight = {
  kind: string;
  severity: "positive" | "warning" | "critical" | string;
  title: string;
  description: string;
  change_percent?: number | null;
};

export type UserProfileSummary = {
  user_id: string;
  first_seen?: string | null;
  last_seen?: string | null;
  event_count: number;
  session_count: number;
  error_count: number;
  page_view_count: number;
  top_pages: AnalyticsBreakdownItem[];
  countries: AnalyticsBreakdownItem[];
  devices: AnalyticsBreakdownItem[];
  browsers: AnalyticsBreakdownItem[];
  referrers: AnalyticsBreakdownItem[];
};

export type PresenceVisitor = {
  user_id?: string | null;
  anonymous_id: string;
  session_id: string;
  path?: string | null;
  url?: string | null;
  title?: string | null;
  last_seen: string;
};

export type PresenceSnapshot = {
  online_users: number;
  identified_users: number;
  anonymous_users: number;
  active_sessions: number;
  visitors: PresenceVisitor[];
};

export type EventRow = {
  id: string;
  event_type: string;
  event_name?: string;
  user_id?: string;
  anonymous_id?: string;
  session_id?: string;
  trace_id?: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type SessionEventRow = {
  id: string;
  project_id: string;
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  action: "start" | "end";
  properties: Record<string, unknown>;
  timestamp: string;
  created_at?: string;
  updated_at?: string;
};

export type SessionSummaryRow = {
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  event_count: number;
  first_seen: string;
  last_seen: string;
};
