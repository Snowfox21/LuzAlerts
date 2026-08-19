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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
