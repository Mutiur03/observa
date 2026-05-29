export type Project = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: string;
};

export type OverviewStats = {
  events: number;
  errors: number;
  requests: number;
  sessions: number;
  failed_jobs: number;
  failed_webhooks: number;
  monitor_down: number;
};

export type EventRow = {
  id: string;
  event_type: string;
  event_name?: string;
  user_id?: string;
  session_id?: string;
  trace_id?: string;
  timestamp: string;
  properties: Record<string, unknown>;
};
