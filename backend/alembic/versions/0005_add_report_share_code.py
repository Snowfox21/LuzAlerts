"""add share_code and share counters to user_reports

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-30
"""
import secrets

import sqlalchemy as sa
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

# Тот же алфавит и длина, что в app/sharing.py: без 0/O/1/I/L. Значения
# продублированы намеренно — миграция должна оставаться воспроизводимой,
# даже если приложение потом сменит формат кода.
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LENGTH = 8


def upgrade():
    op.execute("ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS share_code VARCHAR(12)")
    op.execute("ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS share_view_count INTEGER NOT NULL DEFAULT 0")

    # Бэкфилл существующих меток. Делаем на питоне, а не одним UPDATE:
    # некоррелированный подзапрос с random() постгрес вправе вычислить один
    # раз на весь UPDATE и выдать всем строкам один и тот же код, а уже
    # выданные коды надо гарантированно развести между собой.
    conn = op.get_bind()
    ids = [r[0] for r in conn.execute(
        sa.text("SELECT id FROM user_reports WHERE share_code IS NULL")
    )]
    used: set[str] = {
        r[0] for r in conn.execute(
            sa.text("SELECT share_code FROM user_reports WHERE share_code IS NOT NULL")
        )
    }
    for report_id in ids:
        code = _unique_code(used)
        conn.execute(
            sa.text("UPDATE user_reports SET share_code = :code WHERE id = :id"),
            {"code": code, "id": report_id},
        )

    # Уникальность вешаем после бэкфилла: иначе индекс собирается на одних
    # NULL и не защищает сам бэкфилл.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_reports_share_code "
        "ON user_reports (share_code)"
    )


def _unique_code(used: set[str]) -> str:
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
        if code not in used:
            used.add(code)
            return code


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_user_reports_share_code")
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS share_view_count")
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS share_count")
    op.execute("ALTER TABLE user_reports DROP COLUMN IF EXISTS share_code")
