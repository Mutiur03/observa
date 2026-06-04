from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.events import ApiRequestEvent, ErrorEvent, Event, JobEvent, WebhookEvent
from app.models.monitoring import Monitor, MonitorCheck
from app.repositories.events import EventRepository
from app.schemas.dashboard import (
    AutomatedInsight,
    AnalyticsBreakdownItem,
    AnalyticsSeriesPoint,
    ComparisonMetric,
    FunnelStepMetric,
    FunnelSummary,
    AnalyticsSummary,
    OverviewStats,
    PageDetailSummary,
    PeriodComparison,
    RetentionPoint,
    SessionSummaryItem,
    TimelineItem,
    UserProfileSummary,
    WebVitalMetric,
)
from app.services.presence import PresenceService


class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.events = EventRepository(db)

    def overview(self, project_id: str, time_range: str = "24h") -> OverviewStats:
        presence = PresenceService().snapshot(project_id)
        normalized_range, start, end = self._overview_window(time_range)
        return OverviewStats(
            time_range=normalized_range,
            online_users=presence.online_users,
            active_sessions=presence.active_sessions,
            active_users=self.events.count_active_users(project_id, start, end),
            new_users=self.events.count_new_users(project_id, start, end),
            events=self.events.count(Event, project_id),
            errors=self.events.count(ErrorEvent, project_id),
            requests=self.events.count(ApiRequestEvent, project_id),
            sessions=self.events.count_unique_sessions(project_id),
            failed_jobs=self.db.query(JobEvent).filter_by(project_id=project_id, status="failed").count(),
            failed_webhooks=self.db.query(WebhookEvent).filter_by(project_id=project_id, is_success=False).count(),
            monitor_down=(
                self.db.query(MonitorCheck)
                .join(Monitor, Monitor.id == MonitorCheck.monitor_id)
                .filter(Monitor.project_id == project_id, MonitorCheck.is_success.is_(False))
                .count()
            ),
        )

    def analytics(self, project_id: str, time_range: str = "24h") -> AnalyticsSummary:
        normalized_range, start, end = self._overview_window(time_range)
        interval = "hour" if normalized_range == "24h" else "day"
        return AnalyticsSummary(
            time_range=normalized_range,
            page_views=self.events.count_page_views(project_id, start, end),
            visitors=self.events.count_visitors(project_id, start, end),
            sessions=self.events.count_sessions_with_page_views(project_id, start, end),
            bot_page_views=self.events.count_bot_page_views(project_id, start, end),
            top_pages=self._breakdown(project_id, "path", start, end),
            referrers=self._breakdown(project_id, "referrer_host", start, end),
            utm_sources=self._breakdown(project_id, "utm_source", start, end),
            traffic_channels=self._breakdown(project_id, "traffic_channel", start, end),
            countries=self._breakdown(project_id, "geo_country", start, end),
            cities=self._breakdown(project_id, "geo_city", start, end),
            devices=self._breakdown(project_id, "device_type", start, end),
            browsers=self._breakdown(project_id, "browser", start, end),
            web_vitals=[
                WebVitalMetric(
                    name=str(row["name"]),
                    average=round(float(row["average"] or 0), 2),
                    p75=round(float(row["p75"] or 0), 2),
                    count=int(row["count"] or 0),
                )
                for row in self.events.web_vitals_summary(project_id, start, end)
            ],
            retention=[
                RetentionPoint(
                    date=row["date"],
                    active_users=int(row["active_users"] or 0),
                    new_users=int(row["new_users"] or 0),
                    returning_users=int(row["returning_users"] or 0),
                )
                for row in self.events.retention_points(project_id, start, end)
            ],
            series=[
                AnalyticsSeriesPoint(
                    timestamp=row["timestamp"],
                    page_views=int(row["page_views"] or 0),
                    visitors=int(row["visitors"] or 0),
                )
                for row in self.events.analytics_series(project_id, start, end, interval)
            ],
        )

    def page_detail(self, project_id: str, path: str, time_range: str = "24h") -> PageDetailSummary:
        normalized_range, start, end = self._overview_window(time_range)
        interval = "hour" if normalized_range == "24h" else "day"
        return PageDetailSummary(
            time_range=normalized_range,
            path=path,
            page_views=self.events.count_page_views_for_path(project_id, path, start, end),
            visitors=self.events.count_visitors_for_path(project_id, path, start, end),
            sessions=self.events.count_sessions_for_path(project_id, path, start, end),
            events=self.events.count_events_for_path(project_id, path, start, end),
            errors=self.events.count_errors_for_path(project_id, path, start, end),
            referrers=self._page_breakdown(project_id, path, "referrer_host", start, end),
            countries=self._page_breakdown(project_id, path, "geo_country", start, end),
            cities=self._page_breakdown(project_id, path, "geo_city", start, end),
            devices=self._page_breakdown(project_id, path, "device_type", start, end),
            browsers=self._page_breakdown(project_id, path, "browser", start, end),
            web_vitals=[
                WebVitalMetric(
                    name=str(row["name"]),
                    average=round(float(row["average"] or 0), 2),
                    p75=round(float(row["p75"] or 0), 2),
                    count=int(row["count"] or 0),
                )
                for row in self.events.web_vitals_summary_for_path(project_id, path, start, end)
            ],
            series=[
                AnalyticsSeriesPoint(
                    timestamp=row["timestamp"],
                    page_views=int(row["page_views"] or 0),
                    visitors=int(row["visitors"] or 0),
                )
                for row in self.events.page_analytics_series(project_id, path, start, end, interval)
            ],
        )

    def period_comparison(self, project_id: str, time_range: str = "24h") -> PeriodComparison:
        normalized_range, start, end = self._overview_window(time_range)
        previous_start, previous_end = self._previous_window(start, end)
        return PeriodComparison(
            time_range=normalized_range,
            page_views=self._comparison(
                self.events.count_page_views(project_id, start, end),
                self.events.count_page_views(project_id, previous_start, previous_end),
            ),
            visitors=self._comparison(
                self.events.count_visitors(project_id, start, end),
                self.events.count_visitors(project_id, previous_start, previous_end),
            ),
            sessions=self._comparison(
                self.events.count_sessions_with_page_views(project_id, start, end),
                self.events.count_sessions_with_page_views(project_id, previous_start, previous_end),
            ),
            active_users=self._comparison(
                self.events.count_active_users(project_id, start, end),
                self.events.count_active_users(project_id, previous_start, previous_end),
            ),
            events=self._comparison(
                self.events.count_events(project_id, start, end),
                self.events.count_events(project_id, previous_start, previous_end),
            ),
            errors=self._comparison(
                self.events.count_errors(project_id, start, end),
                self.events.count_errors(project_id, previous_start, previous_end),
            ),
        )

    def insights(self, project_id: str, time_range: str = "24h") -> list[AutomatedInsight]:
        comparison = self.period_comparison(project_id, time_range)
        _, start, end = self._overview_window(time_range)
        previous_start, previous_end = self._previous_window(start, end)
        insights: list[AutomatedInsight] = []
        metrics = [
            ("traffic", "Page views", comparison.page_views, False),
            ("visitors", "Visitors", comparison.visitors, False),
            ("sessions", "Sessions", comparison.sessions, False),
            ("errors", "Errors", comparison.errors, True),
        ]
        for kind, label, metric, inverse in metrics:
            if metric.previous == 0 and metric.current == 0:
                continue
            change = metric.change_percent
            if abs(change) < 20:
                continue
            bad = change > 0 if inverse else change < 0
            direction = "increased" if change > 0 else "decreased"
            insights.append(
                AutomatedInsight(
                    kind=kind,
                    severity="warning" if bad else "positive",
                    title=f"{label} {direction} {abs(change):.1f}%",
                    description=f"{label} changed from {metric.previous:,} to {metric.current:,} versus the previous equal period.",
                    change_percent=change,
                )
            )
        if comparison.errors.current >= 5 and comparison.errors.change_percent >= 50:
            insights.insert(
                0,
                AutomatedInsight(
                    kind="anomaly",
                    severity="critical",
                    title="Error spike detected",
                    description="Errors increased sharply versus the previous equal period. Review recent error events and affected sessions.",
                    change_percent=comparison.errors.change_percent,
                ),
            )
        previous_vitals = {
            str(row["name"]): float(row["p75"] or 0)
            for row in self.events.web_vitals_summary(project_id, previous_start, previous_end)
        }
        for row in self.events.web_vitals_summary(project_id, start, end):
            name = str(row["name"])
            current = float(row["p75"] or 0)
            previous = previous_vitals.get(name, 0)
            if not previous:
                continue
            change = ((current - previous) / previous) * 100
            if change >= 20:
                insights.append(
                    AutomatedInsight(
                        kind="performance",
                        severity="warning",
                        title=f"{name} performance regressed {change:.1f}%",
                        description=f"{name} p75 increased from {previous:.1f} to {current:.1f} versus the previous equal period.",
                        change_percent=round(change, 2),
                    )
                )
        return insights[:6]

    def user_profile(self, project_id: str, user_id: str) -> UserProfileSummary:
        stats = self.events.user_profile_stats(project_id, user_id)
        return UserProfileSummary(
            user_id=user_id,
            first_seen=stats["first_seen"],
            last_seen=stats["last_seen"],
            event_count=int(stats["event_count"] or 0),
            session_count=int(stats["session_count"] or 0),
            error_count=int(stats["error_count"] or 0),
            page_view_count=int(stats["page_view_count"] or 0),
            top_pages=self._user_breakdown(project_id, user_id, "path"),
            countries=self._user_breakdown(project_id, user_id, "geo_country"),
            devices=self._user_breakdown(project_id, user_id, "device_type"),
            browsers=self._user_breakdown(project_id, user_id, "browser"),
            referrers=self._user_breakdown(project_id, user_id, "referrer_host"),
        )

    def funnel(self, project_id: str, time_range: str = "24h", steps_text: str | None = None) -> FunnelSummary:
        normalized_range, start, end = self._overview_window(time_range)
        steps = self._parse_funnel_steps(steps_text)
        counts = self.events.funnel_counts(project_id, steps, start, end)
        total = counts[0] if counts else 0
        previous = total
        items: list[FunnelStepMetric] = []
        for step, count in zip(steps, counts):
            items.append(
                FunnelStepMetric(
                    label=step["label"],
                    event_type=step["event_type"],
                    event_name=step["event_name"],
                    users=count,
                    conversion_rate=round((count / total) * 100, 2) if total else 0,
                    dropoff_rate=round(((previous - count) / previous) * 100, 2) if previous else 0,
                )
            )
            previous = count
        return FunnelSummary(time_range=normalized_range, total_users=total, steps=items)

    def _breakdown(self, project_id: str, property_name: str, start: datetime | None, end: datetime | None) -> list[AnalyticsBreakdownItem]:
        return [
            AnalyticsBreakdownItem(label=str(row["label"]), count=int(row["count"] or 0))
            for row in self.events.analytics_breakdown(project_id, property_name, start, end)
        ]

    def _page_breakdown(self, project_id: str, path: str, property_name: str, start: datetime | None, end: datetime | None) -> list[AnalyticsBreakdownItem]:
        return [
            AnalyticsBreakdownItem(label=str(row["label"]), count=int(row["count"] or 0))
            for row in self.events.page_analytics_breakdown(project_id, path, property_name, start, end)
        ]

    def _user_breakdown(self, project_id: str, user_id: str, property_name: str) -> list[AnalyticsBreakdownItem]:
        return [
            AnalyticsBreakdownItem(label=str(row["label"]), count=int(row["count"] or 0))
            for row in self.events.user_breakdown(project_id, user_id, property_name)
        ]

    def _comparison(self, current: int, previous: int) -> ComparisonMetric:
        change = ((current - previous) / previous) * 100 if previous else (100 if current else 0)
        return ComparisonMetric(current=current, previous=previous, change_percent=round(change, 2))

    def _previous_window(self, start: datetime | None, end: datetime | None) -> tuple[datetime | None, datetime | None]:
        if not start or not end:
            return None, None
        duration = end - start
        return start - duration, start

    def _parse_funnel_steps(self, steps_text: str | None) -> list[dict[str, str | None]]:
        raw_steps = steps_text or "page_view:*,custom_event:sign_up,custom_event:purchase"
        steps: list[dict[str, str | None]] = []
        for raw_step in raw_steps.split(","):
            value = raw_step.strip()
            if not value:
                continue
            event_type, _, event_name = value.partition(":")
            normalized_name = event_name.strip() or None
            steps.append(
                {
                    "event_type": event_type.strip(),
                    "event_name": normalized_name,
                    "label": event_type.strip() if normalized_name in (None, "*") else normalized_name,
                }
            )
        return steps[:8]

    def _overview_window(self, time_range: str) -> tuple[str, datetime | None, datetime | None]:
        windows = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
            "90d": timedelta(days=90),
        }
        normalized = time_range if time_range in {*windows, "all"} else "24h"
        if normalized == "all":
            return normalized, None, None
        end = datetime.now(timezone.utc)
        return normalized, end - windows[normalized], end

    def events_page(
        self,
        project_id: str,
        page: int,
        page_size: int,
        event_type: str | None,
        session_id: str | None = None,
        user_id: str | None = None,
        anonymous_id: str | None = None,
        trace_id: str | None = None,
        search: str | None = None,
    ):
        items, total = self.events.paginate_events(
            project_id,
            page,
            page_size,
            event_type,
            session_id=session_id,
            user_id=user_id,
            anonymous_id=anonymous_id,
            trace_id=trace_id,
            search=search,
        )
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    def model_page(self, model: type, project_id: str, page: int, page_size: int):
        items, total = self.events.list_model(model, project_id, page, page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    def timeline(self, project_id: str, user_id: str) -> list[TimelineItem]:
        return [
            TimelineItem(id=item.id, kind=item.event_type, name=item.event_name, timestamp=item.timestamp, properties=item.properties)
            for item in self.events.timeline_for_user(project_id, user_id)
        ]

    def sessions_page(self, project_id: str, page: int, page_size: int):
        rows, total = self.events.list_sessions(project_id, page, page_size)
        items = [
            SessionSummaryItem(
                session_id=row["session_id"],
                user_id=row["user_id"],
                anonymous_id=row["anonymous_id"],
                event_count=int(row["event_count"] or 0),
                first_seen=row["first_seen"],
                last_seen=row["last_seen"],
            )
            for row in rows
        ]
        return {"items": items, "total": total, "page": page, "page_size": page_size}
