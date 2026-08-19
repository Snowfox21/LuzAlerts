"""add resolved_reason to user_reports

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-19
"""
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE user_reports "
        "ADD COLUMN IF NOT EXISTS resolved_reason VARCHAR(16)"
    )
    # Все, что было закрыто до этой миграции, закрывал только автор.
    op.execute(
        "UPDATE user_reports SET resolved_reason = 'author' "
        "WHERE resolved_at IS NOT NULL AND resolved_reason IS NULL"
    )


def downgrade():
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS resolved_reason")
