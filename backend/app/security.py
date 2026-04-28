from fastapi import Header, HTTPException, status

from app.config import settings


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    expected = settings.ADMIN_API_KEY
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API no configurada",
        )
    if x_admin_key != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Prohibido: Se requiere acceso de administrador",
        )
