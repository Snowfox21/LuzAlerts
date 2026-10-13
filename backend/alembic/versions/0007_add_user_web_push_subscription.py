"""add web_push_subscription to users (Web Push для PWA на iOS)

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-23
"""
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    # Отдельная колонка, а не fcm_token: подписка Web Push — это JSON-объект
    # (endpoint + ключи), а не строковый токен. Существующий поток
    # Expo Push -> FCM этим не затрагивается.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS web_push_subscription TEXT")


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS web_push_subscription")
