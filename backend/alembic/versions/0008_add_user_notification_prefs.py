"""add notification preferences to users (экран Ajustes)

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-24
"""
from alembic import op

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    # Дефолты повторяют прежнее поведение: все пуши включены, радиус 5 км.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_outages BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_resolved BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_radius_m INTEGER NOT NULL DEFAULT 5000")


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notify_radius_m")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notify_resolved")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notify_outages")
