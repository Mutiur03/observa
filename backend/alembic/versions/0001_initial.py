"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

jsonb = postgresql.JSONB(astext_type=sa.Text())


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def id_column() -> sa.Column:
    return sa.Column("id", sa.String(), nullable=False)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        id_column(),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "organizations",
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        id_column(),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    op.create_table(
        "organization_members",
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

    op.create_table(
        "projects",
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("environment", sa.String(50), nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_slug", "projects", ["slug"])

    op.create_table(
        "api_keys",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(20), nullable=False),
        sa.Column("key_type", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

    op.create_table(
        "events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("event_name", sa.String(200), nullable=True),
        sa.Column("user_id", sa.String(200), nullable=True),
        sa.Column("anonymous_id", sa.String(200), nullable=True),
        sa.Column("session_id", sa.String(200), nullable=True),
        sa.Column("trace_id", sa.String(200), nullable=True),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("environment", sa.String(50), nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "event_type", "event_name", "user_id", "anonymous_id", "session_id", "trace_id"]:
        op.create_index(f"ix_events_{column}", "events", [column])

    op.create_table(
        "error_events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=True),
        sa.Column("error_type", sa.String(100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("user_id", sa.String(200), nullable=True),
        sa.Column("session_id", sa.String(200), nullable=True),
        sa.Column("trace_id", sa.String(200), nullable=True),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "user_id", "session_id", "trace_id"]:
        op.create_index(f"ix_error_events_{column}", "error_events", [column])

    op.create_table(
        "api_request_events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("method", sa.String(12), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(200), nullable=True),
        sa.Column("session_id", sa.String(200), nullable=True),
        sa.Column("trace_id", sa.String(200), nullable=True),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "path", "status_code", "user_id", "session_id", "trace_id"]:
        op.create_index(f"ix_api_request_events_{column}", "api_request_events", [column])

    op.create_table(
        "session_events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(200), nullable=False),
        sa.Column("user_id", sa.String(200), nullable=True),
        sa.Column("anonymous_id", sa.String(200), nullable=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "session_id", "user_id", "anonymous_id"]:
        op.create_index(f"ix_session_events_{column}", "session_events", [column])

    op.create_table(
        "job_events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("job_name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.String(200), nullable=True),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "job_name", "status", "trace_id"]:
        op.create_index(f"ix_job_events_{column}", "job_events", [column])

    op.create_table(
        "webhook_events",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("webhook_name", sa.String(200), nullable=False),
        sa.Column("target_url", sa.String(1000), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("is_success", sa.Boolean(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.String(200), nullable=True),
        sa.Column("properties", jsonb, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["project_id", "webhook_name", "is_success", "trace_id"]:
        op.create_index(f"ix_webhook_events_{column}", "webhook_events", [column])

    op.create_table(
        "monitors",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("method", sa.String(12), nullable=False),
        sa.Column("expected_status", sa.Integer(), nullable=False),
        sa.Column("interval_seconds", sa.Integer(), nullable=False),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_monitors_project_id", "monitors", ["project_id"])

    op.create_table(
        "monitor_checks",
        sa.Column("monitor_id", sa.String(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("is_success", sa.Boolean(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        id_column(),
        sa.ForeignKeyConstraint(["monitor_id"], ["monitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_monitor_checks_monitor_id", "monitor_checks", ["monitor_id"])
    op.create_index("ix_monitor_checks_is_success", "monitor_checks", ["is_success"])

    op.create_table(
        "alert_rules",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("rule_type", sa.String(60), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=True),
        sa.Column("window_seconds", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("notification_config", jsonb, nullable=False),
        id_column(),
        *timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rules_project_id", "alert_rules", ["project_id"])
    op.create_index("ix_alert_rules_rule_type", "alert_rules", ["rule_type"])


def downgrade() -> None:
    for table_name in [
        "alert_rules",
        "monitor_checks",
        "monitors",
        "webhook_events",
        "job_events",
        "session_events",
        "api_request_events",
        "error_events",
        "events",
        "api_keys",
        "projects",
        "organization_members",
        "organizations",
        "users",
    ]:
        op.drop_table(table_name)
