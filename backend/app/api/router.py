from fastapi import APIRouter

from app.api.routes import health, intentions, me, notifications, reminders, resurfacing

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(intentions.router)
api_router.include_router(resurfacing.router)
api_router.include_router(reminders.router)
api_router.include_router(notifications.router)
