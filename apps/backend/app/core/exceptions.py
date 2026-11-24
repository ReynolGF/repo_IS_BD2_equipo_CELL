"""Errores de dominio y su traducción a respuestas HTTP.

Los servicios lanzan estas excepciones y no conocen HTTP; el manejador registrado en
``register_exception_handlers`` las convierte en respuestas ``{"detail": "..."}``.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Error base de la aplicación."""

    status_code = 500

    def __init__(self, detail: str) -> None:
        """Guarda el mensaje que verá el cliente."""
        super().__init__(detail)
        self.detail = detail


class AuthenticationError(AppError):
    """Credenciales o token ausentes, inválidos o caducados (401)."""

    status_code = 401


class PermissionDeniedError(AppError):
    """El usuario está identificado pero no tiene permiso para la acción (403)."""

    status_code = 403


class NotFoundError(AppError):
    """El recurso solicitado no existe (404)."""

    status_code = 404


class ConflictError(AppError):
    """La acción choca con el estado actual de los datos, por ejemplo un duplicado (409)."""

    status_code = 409


class BusinessRuleError(AppError):
    """La petición es válida pero incumple una regla de negocio (422)."""

    status_code = 422


def register_exception_handlers(app: FastAPI) -> None:
    """Registra en la aplicación la conversión de ``AppError`` a respuestas JSON."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        """Devuelve el error de dominio con su código HTTP."""
        headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, AuthenticationError) else None
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail}, headers=headers
        )
