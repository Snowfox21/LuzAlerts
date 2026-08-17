"""add confirmation_count to user_reports

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-11
"""
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    # IF NOT EXISTS: на проде колонка была добавлена вручную до появления миграции.
    op.execute(
        "ALTER TABLE user_reports "
        "ADD COLUMN IF NOT EXISTS confirmation_count INTEGER NOT NULL DEFAULT 0"
    )


def downgrade():
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS confirmation_count")
