"""Gestión de usuarios: alta, modificación y baja lógica.

Los usuarios no se eliminan: se desactivan con ``is_active = False`` para conservar su historial.
"""

from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.core.security import hash_password
from app.db.enums import Occupation, PlanStatus
from app.models.plans import Plan, PlanOperatorAssignment
from app.models.users import Administrator, Operator, PlantManager, Technician, User
from app.repositories import users as users_repo
from app.schemas.users import UserCreate, UserUpdate

_DUPLICATE_EMAIL = "Ya existe un usuario con ese correo"

# Campos de perfil modificables y el rol al que pertenece cada uno.
_PROFILE_FIELDS = {
    "specialty": Occupation.technician,
    "age": Occupation.operator,
    "shift": Occupation.operator,
}


def get_user(db: Session, id_user: int) -> User:
    """Devuelve un usuario o lanza ``NotFoundError``."""
    user = users_repo.get_by_id(db, id_user)
    if user is None:
        raise NotFoundError("Usuario no encontrado")
    return user


def list_users(
    db: Session,
    *,
    occupation: Occupation | None,
    is_active: bool | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[User], int]:
    """Lista usuarios con filtros y paginación."""
    return users_repo.list_users(
        db,
        occupation=occupation,
        is_active=is_active,
        search=search,
        limit=limit,
        offset=offset,
    )


def create_user(db: Session, data: UserCreate) -> User:
    """Crea un usuario junto con su fila de subtipo según el rol.

    Raises:
        ConflictError: Ya existe un usuario con ese correo.
    """
    if users_repo.get_by_email(db, data.email) is not None:
        raise ConflictError(_DUPLICATE_EMAIL)

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        occupation=data.occupation,
    )
    if data.occupation is Occupation.technician:
        user.technician = Technician(specialty=data.specialty)
    elif data.occupation is Occupation.operator:
        user.operator = Operator(age=data.age, shift=data.shift)
    elif data.occupation is Occupation.plant_manager:
        user.manager = PlantManager()
    else:
        user.admin = Administrator()

    try:
        with db.begin_nested():  # si falla (correo duplicado en paralelo) solo se deshace esto
            db.add(user)
    except IntegrityError:
        raise ConflictError(_DUPLICATE_EMAIL) from None
    db.commit()
    return user


def _ensure_not_self(user: User, actor: User) -> None:
    """Impide que el administrador desactive su propia cuenta."""
    if user.id_user == actor.id_user:
        raise BusinessRuleError("No puedes desactivar tu propia cuenta")


def _release_operator_plans(db: Session, operator: Operator) -> None:
    """Desasigna a un operario de todos los planes que no estén finalizados.

    Se ejecuta en la misma transacción que la baja, así que o se hace todo o nada. Los planes
    ``completed`` conservan su asignación como historial; el resto (generado, validado,
    aprobado, rechazado o en ejecución) queda sin operario y habrá que reasignarlo. Las
    intervenciones ya registradas por el operario no se tocan.
    """
    db.execute(
        delete(PlanOperatorAssignment).where(
            PlanOperatorAssignment.id_operator == operator.id_operator,
            PlanOperatorAssignment.id_plan.in_(
                select(Plan.id_plan).where(Plan.status != PlanStatus.completed)
            ),
        )
    )


def _apply_profile_changes(user: User, changes: dict[str, object]) -> None:
    """Aplica los cambios de los campos de perfil, comprobando que correspondan al rol."""
    for field, role in _PROFILE_FIELDS.items():
        value = changes.get(field)
        if value is None:
            continue
        if user.occupation is not role:
            raise BusinessRuleError(
                f"El campo '{field}' no aplica a un usuario {user.occupation.value}"
            )
        profile = user.technician if role is Occupation.technician else user.operator
        if profile is None:
            raise BusinessRuleError("El usuario no tiene perfil asociado")
        setattr(profile, field, value)


def update_user(db: Session, user: User, data: UserUpdate, actor: User) -> User:
    """Modifica los campos enviados de un usuario.

    Al dar de baja a un operario se le desasigna de todos los planes no finalizados. Reactivarlo
    no restituye esas asignaciones.

    Raises:
        ConflictError: El nuevo correo ya lo usa otro usuario.
        BusinessRuleError: Se intenta desactivar la propia cuenta o cambiar un campo de perfil
            que no corresponde al rol.
    """
    changes = data.model_dump(exclude_unset=True)

    email = changes.get("email")
    if email is not None and email != user.email:
        other = users_repo.get_by_email(db, email)
        if other is not None and other.id_user != user.id_user:
            raise ConflictError(_DUPLICATE_EMAIL)
        user.email = email

    if changes.get("name") is not None:
        user.name = changes["name"]
    if changes.get("password") is not None:
        user.password_hash = hash_password(changes["password"])

    is_active = changes.get("is_active")
    if is_active is not None and is_active != user.is_active:
        if not is_active:
            _ensure_not_self(user, actor)
        user.is_active = is_active
        if not is_active and user.operator is not None:
            _release_operator_plans(db, user.operator)

    _apply_profile_changes(user, changes)

    try:
        db.commit()
    except IntegrityError:  # otro usuario tomó el correo entre la comprobación y el guardado
        db.rollback()
        raise ConflictError(_DUPLICATE_EMAIL) from None
    return user
