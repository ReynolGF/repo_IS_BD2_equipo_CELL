# Cell — Sistema de Gestión de Planes de Mantenimiento Industrial

Aplicación web para la generación automática de planes de mantenimiento en una planta industrial
(proyecto de Bases de Datos II e Ingeniería de Software).

## Estructura

```
apps/
  backend/    API en FastAPI (PostgreSQL + MongoDB + Redis)
  frontend/   Interfaz web
docs/         Documentación y decisiones de diseño
```

## Arranque rápido (todo el sistema con Docker)

Requisitos: Git y Docker (con Compose).

```bash
git clone <url-del-repo>
cd <repo>
cp .env.example .env
docker compose up --build
```

| URL | Qué es |
|---|---|
| http://localhost:8000/health | La API está viva |
| http://localhost:8000/health/ready | Conexión con PostgreSQL, MongoDB y Redis |
| http://localhost:8000/docs | Documentación Swagger |

En Windows, usar `copy .env.example .env` en lugar de `cp`.

### Crear el primer administrador

Solo un administrador puede crear usuarios, así que el primero se crea por consola (pide la
contraseña sin mostrarla):

```bash
docker compose exec api python -m app.scripts.create_admin --name "Ana Pérez" --email ana@planta.com
```

Después, en http://localhost:8000/docs: `POST /auth/login`, copiar el `access_token` y pulsar
**Authorize** para probar el resto de endpoints. Más detalles en
[docs/seguridad-y-usuarios.md](docs/seguridad-y-usuarios.md).

## Desarrollo del backend (sin Docker para la API)

Levantar solo las bases de datos y ejecutar la API en local:

```bash
docker compose up -d postgres mongo redis

cd apps/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Calidad y pruebas

```bash
cd apps/backend
ruff check .
ruff format --check .
mypy app
pytest                        # todas (las de integración requieren Docker)
pytest -m "not integration"   # solo las unitarias
```

## Migraciones de base de datos

El esquema lo gestiona Alembic (`apps/backend/alembic/versions/`). Con Docker se aplican solas al
arrancar la API (`alembic upgrade head`). Sin Docker, desde `apps/backend` y con el entorno
virtual activo:

```bash
alembic upgrade head        # aplica todas las migraciones
alembic downgrade base      # deshace todo (borra los datos)
alembic current             # versión aplicada
```

Cuando cambies un modelo, genera la migración y **revísala antes de confirmarla**:

```bash
alembic revision --autogenerate -m "describe el cambio"
```

La primera migración (`3f1c2a9d7b10_esquema_inicial.py`) está escrita a mano y la prueba
`tests/integration/test_migrations.py` comprueba que produce exactamente el esquema de los
modelos; si cambias un modelo sin migración, esa prueba falla.

## Más información

- Convenciones de ramas, commits y PRs: [CONTRIBUTING.md](CONTRIBUTING.md)
- Decisiones del backend: [docs/decisiones-backend.md](docs/decisiones-backend.md)
