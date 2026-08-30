"""Публичные коды меток и ссылки для шеринга.

Метка шарится в WhatsApp ссылкой вида https://luzalerts.lat/r/{share_code}.
В ссылке стоит случайный код, а не первичный ключ: id последовательный, и по
нему перебором вычитывались бы все метки страны через публичную страницу.
"""
import secrets

from app.config import settings

# Без 0/O/1/I/L — код диктуют вслух и набирают руками, похожие символы
# превращаются в чужую метку или 404.
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LENGTH = 8


def generate_share_code() -> str:
    """Случайный код метки. 31^8 ≈ 8.5e11 вариантов — перебор бессмыслен."""
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def share_url(share_code: str | None) -> str | None:
    """Публичный URL метки. None, если кода нет (метки до миграции 0005)."""
    if not share_code:
        return None
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/r/{share_code}"
