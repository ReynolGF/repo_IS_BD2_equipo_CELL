"""Punto de entrada de la aplicación FastAPI."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, authorizations, equipment, health, lines, users
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

settings = get_settings()

app = FastAPI(title="Cell - Mantenimiento Industrial", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(authorizations.router)
app.include_router(lines.router)
app.include_router(equipment.router)
