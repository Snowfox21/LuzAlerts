from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.limiter import limiter
from app.routers import users, outages, reports, subscriptions, comments


app = FastAPI(
    title="LuzAlerts API",
    description="Monitoreo de cortes de energía en Paraguay",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(users.router)
app.include_router(outages.router)
app.include_router(reports.router)
app.include_router(subscriptions.router)
app.include_router(comments.router)


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "LuzAlerts API"}
