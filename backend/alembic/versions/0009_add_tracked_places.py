"""add tracked_places (дополнительные места для пушей)

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-26
"""
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tracked_places (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            label VARCHAR(128) NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_tracked_places_user_id ON tracked_places (user_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS tracked_places")
