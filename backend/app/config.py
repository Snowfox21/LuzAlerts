from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://luz:luz@localhost:5432/luzpy"
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    NOMINATIM_EMAIL: str = "dev@luzpy.local"
    REPORT_RADIUS_M: int = 500
    REPORT_THRESHOLD: int = 3

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
