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

## Más información

- Convenciones de ramas, commits y PRs: [CONTRIBUTING.md](CONTRIBUTING.md)
- Decisiones del backend: [docs/decisiones-backend.md](docs/decisiones-backend.md)
