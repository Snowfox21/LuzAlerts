"""add resolved_at to user_reports

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-17
"""
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE user_reports "
        "ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITHOUT TIME ZONE"
    )


def downgrade():
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS resolved_at")
