"""Link detail logs to activity events.

Revision ID: 0002_link_event_details
Revises: 0001_initial
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_link_event_details"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

TABLES = ("api_request_events", "session_events", "job_events", "webhook_events")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("event_id", sa.String(), nullable=True))
        op.create_foreign_key(f"fk_{table}_event_id", table, "events", ["event_id"], ["id"], ondelete="SET NULL")
        op.create_index(f"ix_{table}_event_id", table, ["event_id"])


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_index(f"ix_{table}_event_id", table_name=table)
        op.drop_constraint(f"fk_{table}_event_id", table, type_="foreignkey")
        op.drop_column(table, "event_id")
