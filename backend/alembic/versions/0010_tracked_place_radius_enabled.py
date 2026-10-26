"""radius_m и enabled у отслеживаемых мест (экран "Mis zonas")

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-26
"""
from alembic import op

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE tracked_places ADD COLUMN IF NOT EXISTS radius_m INTEGER")
    # Существующие места до сих пор работали на радиусе устройства — его и
    # сохраняем, если он есть среди шагов места (1/2/5/10 км), иначе 5 км.
    op.execute("""
        UPDATE tracked_places p SET radius_m = CASE
            WHEN u.notify_radius_m IN (1000, 2000, 5000, 10000) THEN u.notify_radius_m
            ELSE 5000
        END
        FROM users u WHERE u.id = p.user_id AND p.radius_m IS NULL
    """)
    op.execute("UPDATE tracked_places SET radius_m = 5000 WHERE radius_m IS NULL")
    op.execute("ALTER TABLE tracked_places ALTER COLUMN radius_m SET DEFAULT 2000")
    op.execute("ALTER TABLE tracked_places ALTER COLUMN radius_m SET NOT NULL")
    op.execute("ALTER TABLE tracked_places ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE")


def downgrade():
    op.execute("ALTER TABLE tracked_places DROP COLUMN IF EXISTS enabled")
    op.execute("ALTER TABLE tracked_places DROP COLUMN IF EXISTS radius_m")
