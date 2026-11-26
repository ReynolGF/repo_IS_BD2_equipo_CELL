"""Política de autorización por línea: qué técnico puede generar o validar planes en cada línea.

La base de datos garantiza que un plan solo lo crea un técnico con una fila en
``line_authorization`` para esa línea. Esta política añade lo que la base de datos no puede
comprobar: que el permiso concreto (``can_generate`` o ``can_validate``) esté concedido y que la
cuenta del técnico esté activa.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import PermissionDeniedError
from app.models.users import Technician
from app.repositories import authorizations as auth_repo


class AuthorizationPolicy:
    """Consulta los permisos de los técnicos sobre las líneas de producción."""

    def __init__(self, db: Session) -> None:
        """Crea la política asociada a una sesión de base de datos."""
        self._db = db

    def can_generate(self, id_technician: int, id_line: int) -> bool:
        """Indica si un técnico activo puede generar planes en la línea."""
        authorization = auth_repo.find_active(self._db, id_technician, id_line)
        return authorization is not None and authorization.can_generate

    def can_validate(self, id_technician: int, id_line: int) -> bool:
        """Indica si un técnico activo puede validar planes de la línea."""
        authorization = auth_repo.find_active(self._db, id_technician, id_line)
        return authorization is not None and authorization.can_validate

    def require_generate(self, id_technician: int, id_line: int) -> None:
        """Lanza ``PermissionDeniedError`` si el técnico no puede generar planes en la línea."""
        if not self.can_generate(id_technician, id_line):
            raise PermissionDeniedError("No estás autorizado para generar planes en esta línea")

    def require_validate(self, id_technician: int, id_line: int) -> None:
        """Lanza ``PermissionDeniedError`` si el técnico no puede validar planes de la línea."""
        if not self.can_validate(id_technician, id_line):
            raise PermissionDeniedError("No estás autorizado para validar planes en esta línea")

    def technicians_who_can_generate(self, id_line: int) -> Sequence[Technician]:
        """Lista los técnicos activos que pueden generar planes en la línea."""
        return auth_repo.list_eligible_technicians(self._db, id_line, generate=True)

    def technicians_who_can_validate(self, id_line: int) -> Sequence[Technician]:
        """Lista los técnicos activos que pueden validar planes de la línea."""
        return auth_repo.list_eligible_technicians(self._db, id_line, validate=True)
