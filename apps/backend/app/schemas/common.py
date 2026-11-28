"""Esquemas compartidos por varios módulos."""

from pydantic import BaseModel


class Page[T](BaseModel):
    """Página de resultados de una lista paginada."""

    items: list[T]
    total: int
    limit: int
    offset: int
