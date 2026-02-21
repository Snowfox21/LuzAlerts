from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.routers import users, outages, reports, subscriptions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создаём таблицы при старте (для разработки; в проде — Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="LuzParaguay API",
    description="Мониторинг отключений электроэнергии в Парагвае",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(users.router)
app.include_router(outages.router)
app.include_router(reports.router)
app.include_router(subscriptions.router)


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "LuzParaguay API"}
