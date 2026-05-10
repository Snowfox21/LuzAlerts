"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


outage_source = sa.Enum("ande_official", "crowdsource", "twitter", name="outagesource", create_type=False)
outage_status = sa.Enum("active", "resolved", "planned", name="outagestatus", create_type=False)
user_role = sa.Enum("admin", "user", name="userrole", create_type=False)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    bind = op.get_bind()
    outage_source.create(bind, checkfirst=True)
    outage_status.create(bind, checkfirst=True)
    user_role.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("nis_number", sa.String(length=64), nullable=True),
        sa.Column("feeder_number", sa.String(length=64), nullable=True),
        sa.Column("fcm_token", sa.String(length=512), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_device_id", "users", ["device_id"], unique=True)

    op.create_table(
        "outages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", outage_source, nullable=False),
        sa.Column("status", outage_status, nullable=False, server_default="active"),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("barrio", sa.String(length=128), nullable=True),
        sa.Column("feeder_number", sa.String(length=64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=True),
        sa.Column("scheduled_start", sa.DateTime(), nullable=True),
        sa.Column("scheduled_end", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "user_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("department", sa.String(length=128), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("barrio", sa.String(length=128), nullable=True),
        sa.Column("street", sa.String(length=256), nullable=True),
        sa.Column("house", sa.String(length=64), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "outage_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "outage_id",
            sa.Integer(),
            sa.ForeignKey("outages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_outage_comments_outage_id", "outage_comments", ["outage_id"]
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("barrio", sa.String(length=128), nullable=True),
        sa.Column("feeder_number", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_index("ix_outage_comments_outage_id", table_name="outage_comments")
    op.drop_table("outage_comments")
    op.drop_table("user_reports")
    op.drop_table("outages")
    op.drop_index("ix_users_device_id", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    user_role.drop(bind, checkfirst=True)
    outage_status.drop(bind, checkfirst=True)
    outage_source.drop(bind, checkfirst=True)
