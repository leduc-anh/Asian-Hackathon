from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.risk import router as risk_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(risk_router, tags=["risk"])
