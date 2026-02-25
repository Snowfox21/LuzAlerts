import sys
from pathlib import Path

# Add backend to PYTHONPATH so we can import models and database
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_dir))

from app.config import settings

# Verify it works
print(f"Loaded backend config. DB URL: {settings.DATABASE_URL}")
