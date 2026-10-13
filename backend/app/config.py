from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://luz:luz@localhost:5432/luzalerts"
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    NOMINATIM_EMAIL: str = "dev@luzalerts.local"
    REPORT_RADIUS_M: int = 500
    REPORT_THRESHOLD: int = 3
    # Через сколько часов после создания метка "нет света" считается
    # протухшей и закрывается автоматически, если автор не закрыл ее сам.
    REPORT_AUTO_RESOLVE_HOURS: int = 96
    ADMIN_API_KEY: str | None = None
    # Базовый URL публичной части. Из него собираются ссылки для шеринга
    # (/r/{code}) и абсолютный og:image — относительные пути краулер
    # WhatsApp не резолвит.
    PUBLIC_BASE_URL: str = "https://luzalerts.lat"
    # Схема диплинка мобильного приложения (app.config.js -> scheme).
    APP_SCHEME: str = "luzalerts"
    # Web Push (VAPID) для PWA на iOS. Параллельно Expo Push -> FCM, не вместо.
    # Пустой приватный ключ = web push выключен (бэкенд молча пропускает
    # отправку), пустой публичный = GET /config/vapid-public-key отдает 503.
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_SUBJECT: str = "https://luzalerts.lat"
    # Откуда можно ходить в API из браузера. PWA живет на app.luzalerts.lat,
    # API на luzalerts.lat — это cross-origin. Нативное приложение CORS не
    # касается. Через запятую; localhost — для `expo start --web`.
    CORS_ORIGINS: str = "https://app.luzalerts.lat,http://localhost:8081,http://localhost:19006"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
