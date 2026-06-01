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
  online_users: number;
  active_sessions: number;
  events: number;
  errors: number;
  requests: number;
  sessions: number;
  failed_jobs: number;
  failed_webhooks: number;
  monitor_down: number;
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
