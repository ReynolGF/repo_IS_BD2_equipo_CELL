"""Crea un administrador desde la línea de comandos.

Hace falta para el primer arranque: solo un administrador puede crear usuarios, y al principio no
existe ninguno.

Uso (desde ``apps/backend``)::

    python -m app.scripts.create_admin --name "Ana Pérez" --email ana@planta.com

Con Docker, desde la raíz del repositorio::

    docker compose exec api python -m app.scripts.create_admin \
        --name "Ana Pérez" --email ana@planta.com
"""

import argparse
import getpass
import sys

from pydantic import ValidationError

from app.core.database import SessionLocal
from app.core.exceptions import AppError
from app.db.enums import Occupation
from app.schemas.users import UserCreate
from app.services import users as users_service


def _ask_password() -> str:
    """Pide la contraseña dos veces por consola, sin mostrarla."""
    password = getpass.getpass("Contraseña: ")
    if password != getpass.getpass("Repite la contraseña: "):
        raise SystemExit("Error: las contraseñas no coinciden")
    return password


def main(argv: list[str] | None = None) -> int:
    """Crea el administrador y devuelve el código de salida del proceso."""
    parser = argparse.ArgumentParser(description="Crea un usuario administrador.")
    parser.add_argument("--name", required=True, help="Nombre completo")
    parser.add_argument("--email", required=True, help="Correo electrónico")
    parser.add_argument(
        "--password", help="Contraseña (si se omite, se pide por consola; es lo recomendable)"
    )
    args = parser.parse_args(argv)

    password = args.password or _ask_password()
    try:
        data = UserCreate(
            name=args.name,
            email=args.email,
            password=password,
            occupation=Occupation.administrator,
        )
    except ValidationError as exc:
        for error in exc.errors():
            location = ".".join(str(part) for part in error["loc"])
            print(f"Error en '{location}': {error['msg']}", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        try:
            user = users_service.create_user(db, data)
        except AppError as exc:
            print(f"Error: {exc.detail}", file=sys.stderr)
            return 1
        print(f"Administrador creado: {user.email} (id {user.id_user})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
