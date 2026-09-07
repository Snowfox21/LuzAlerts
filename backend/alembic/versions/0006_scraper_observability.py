"""persist scraper run metrics and ANDE source IDs

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("outages", sa.Column("ande_id", sa.Integer(), nullable=True))
    op.create_index("ix_outages_ande_id", "outages", ["ande_id"])
    op.create_table(
        "scraper_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("attempted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("success", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("source_reachable", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("identity_valid", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("container_found", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("rows_seen", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rows_parsed_ok", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rows_after_filter", sa.Integer(), server_default="0", nullable=False),
        sa.Column("events_written", sa.Integer(), server_default="0", nullable=False),
        sa.Column("ande_ids", sa.JSON(), nullable=False),
        sa.Column("ids_added", sa.JSON(), nullable=False),
        sa.Column("ids_removed", sa.JSON(), nullable=False),
        sa.Column("ids_monotonic", sa.Boolean(), nullable=True),
        sa.Column("ids_dense", sa.Boolean(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("scraper_runs")
    op.drop_index("ix_outages_ande_id", table_name="outages")
    op.drop_column("outages", "ande_id")
