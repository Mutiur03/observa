from datetime import datetime
from typing import Any

from pydantic import BaseModel


class OverviewStats(BaseModel):
    time_range: str
    online_users: int
    active_sessions: int
    active_users: int
    new_users: int
    events: int
    errors: int
    requests: int
    sessions: int
    failed_jobs: int
    failed_webhooks: int
    monitor_down: int


class TimelineItem(BaseModel):
    id: str
    kind: str
    name: str | None
    timestamp: datetime
    properties: dict[str, Any]


class SessionSummaryItem(BaseModel):
    session_id: str
    user_id: str | None
    anonymous_id: str | None
    event_count: int
    first_seen: datetime
    last_seen: datetime


class AnalyticsBreakdownItem(BaseModel):
    label: str
    count: int


class AnalyticsSeriesPoint(BaseModel):
    timestamp: datetime
    page_views: int
    visitors: int


class WebVitalMetric(BaseModel):
    name: str
    average: float
    p75: float
    count: int


class RetentionPoint(BaseModel):
    date: datetime
    active_users: int
    new_users: int
    returning_users: int


class FunnelStepMetric(BaseModel):
    label: str
    event_type: str
    event_name: str | None
    users: int
    conversion_rate: float
    dropoff_rate: float


class FunnelSummary(BaseModel):
    time_range: str
    total_users: int
    steps: list[FunnelStepMetric]


class AnalyticsSummary(BaseModel):
    time_range: str
    page_views: int
    visitors: int
    sessions: int
    bot_page_views: int
    top_pages: list[AnalyticsBreakdownItem]
    referrers: list[AnalyticsBreakdownItem]
    utm_sources: list[AnalyticsBreakdownItem]
    traffic_channels: list[AnalyticsBreakdownItem]
    countries: list[AnalyticsBreakdownItem]
    cities: list[AnalyticsBreakdownItem]
    devices: list[AnalyticsBreakdownItem]
    browsers: list[AnalyticsBreakdownItem]
    web_vitals: list[WebVitalMetric]
    retention: list[RetentionPoint]
    series: list[AnalyticsSeriesPoint]


class PageDetailSummary(BaseModel):
    time_range: str
    path: str
    page_views: int
    visitors: int
    sessions: int
    events: int
    errors: int
    referrers: list[AnalyticsBreakdownItem]
    countries: list[AnalyticsBreakdownItem]
    cities: list[AnalyticsBreakdownItem]
    devices: list[AnalyticsBreakdownItem]
    browsers: list[AnalyticsBreakdownItem]
    web_vitals: list[WebVitalMetric]
    series: list[AnalyticsSeriesPoint]


class ComparisonMetric(BaseModel):
    current: int
    previous: int
    change_percent: float


class PeriodComparison(BaseModel):
    time_range: str
    page_views: ComparisonMetric
    visitors: ComparisonMetric
    sessions: ComparisonMetric
    active_users: ComparisonMetric
    events: ComparisonMetric
    errors: ComparisonMetric


class AutomatedInsight(BaseModel):
    kind: str
    severity: str
    title: str
    description: str
    change_percent: float | None = None


class UserProfileSummary(BaseModel):
    user_id: str
    first_seen: datetime | None
    last_seen: datetime | None
    event_count: int
    session_count: int
    error_count: int
    page_view_count: int
    top_pages: list[AnalyticsBreakdownItem]
    countries: list[AnalyticsBreakdownItem]
    devices: list[AnalyticsBreakdownItem]
    browsers: list[AnalyticsBreakdownItem]
    referrers: list[AnalyticsBreakdownItem]
