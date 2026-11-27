"""Asignación de operarios a líneas de producción (RF37)."""

from collections.abc import Sequence

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.infrastructure import LineAssignment, ProductionLine
from app.models.users import Operator, User
from app.repositories import infrastructure as repo
from app.services.lines import get_line


def _require_operator(db: Session, id_operator: int) -> Operator:
    """Devuelve el operario o lanza ``NotFoundError``."""
    operator = db.get(Operator, id_operator)
    if operator is None:
        raise NotFoundError("Operario no encontrado")
    return operator


def list_operators(db: Session, id_line: int) -> Sequence[tuple[Operator, User]]:
    """Lista los operarios asignados a una línea.

    Raises:
        NotFoundError: La línea no existe.
    """
    get_line(db, id_line)
    return repo.list_operators_of_line(db, id_line)


def list_lines(db: Session, id_operator: int) -> Sequence[ProductionLine]:
    """Lista las líneas de un operario.

    Raises:
        NotFoundError: El operario no existe.
    """
    _require_operator(db, id_operator)
    return repo.list_lines_of_operator(db, id_operator)


def assign(db: Session, id_line: int, id_operator: int) -> LineAssignment:
    """Asigna un operario a una línea (idempotente).

    Raises:
        NotFoundError: La línea o el operario no existen.
        BusinessRuleError: La cuenta del operario está desactivada.
    """
    get_line(db, id_line)
    operator = _require_operator(db, id_operator)
    if not operator.user.is_active:
        raise BusinessRuleError("No se puede asignar a un operario con la cuenta desactivada")
    assignment = repo.get_assignment(db, id_operator, id_line)
    if assignment is None:
        assignment = LineAssignment(id_operator=id_operator, id_line=id_line)
        db.add(assignment)
        db.commit()
    return assignment


def unassign(db: Session, id_line: int, id_operator: int) -> None:
    """Quita a un operario de una línea.

    Raises:
        NotFoundError: El operario no estaba asignado a esa línea.
    """
    if repo.get_assignment(db, id_operator, id_line) is None:
        raise NotFoundError("El operario no está asignado a esa línea")
    db.execute(
        delete(LineAssignment).where(
            LineAssignment.id_operator == id_operator, LineAssignment.id_line == id_line
        )
    )
    db.commit()
