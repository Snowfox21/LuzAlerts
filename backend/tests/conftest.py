import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.main import app
from app.models import UserRole, OutageSource, OutageStatus

# Используем тестовую БД, которую мы создали
TEST_DATABASE_URL = "postgresql+asyncpg://luz:luz@localhost:5432/luzpy_test"

engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
TestingSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database():
    """Создать таблицы перед тестами и удалить после."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Предоставляет сессию БД для тестов."""
    async with TestingSessionLocal() as session:
        yield session

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Test client for making HTTP requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

# --- Хелперы ---

@pytest_asyncio.fixture
async def admin_user(db: AsyncSession):
    import uuid
    from app.models import User
    admin = User(device_id=f"admin-{uuid.uuid4()}", role=UserRole.admin)
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    return admin

@pytest_asyncio.fixture
async def normal_user(db: AsyncSession):
    import uuid
    from app.models import User
    user = User(device_id=f"user-{uuid.uuid4()}", role=UserRole.user)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
