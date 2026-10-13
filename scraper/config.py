import sys
from pathlib import Path

# Add backend to PYTHONPATH so we can import models and database
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_dir))

from sqlalchemy.engine import make_url

from app.config import settings

# Verify it works. Пароль маскируем: этот вывод уходит в docker logs.
print(f"Loaded backend config. DB URL: {make_url(settings.DATABASE_URL).render_as_string(hide_password=True)}")
