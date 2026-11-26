# Decisiones del backend

Este documento registra las decisiones técnicas y las reglas de negocio que el informe de diseño
deja pendientes. Las filas marcadas **Propuesta** deben discutirse y confirmarse en equipo antes de
las fases posteriores.

## Decisiones técnicas

| Tema | Decisión | Estado |
|---|---|---|
| Framework | FastAPI + Pydantic v2 | Acordada |
| Acceso a datos | SQLAlchemy 2.0 **síncrono** + `psycopg` 3; `pymongo` síncrono; `redis-py` síncrono | Acordada |
| Migraciones | Alembic; migración inicial explícita (sin `create_all`), verificada contra los modelos por test | Acordada |
| BD relacional | PostgreSQL 16 | Acordada |
| Series temporales (NoSQL) | MongoDB 7 con *time series collections* | Propuesta |
| Caché de estado operativo | Redis, patrón *cache-aside* con clave `equipo:{id}` | Propuesta |
| Dependencias | `requirements.txt` + `venv` | Acordada |
| Estilo | Ruff (incluye docstrings, regla `D`, convención Google) + mypy | Acordada |
| Multiplataforma | Docker Compose | Acordada |

**Por qué síncrono.** FastAPI ejecuta los endpoints `def` en un pool de hilos, el rendimiento sobra
para este proyecto y se evitan los errores típicos de async (sesiones perdidas, *lazy loading*,
pruebas más complejas). Cambiarlo más adelante es costoso.

## Reglas de negocio pendientes del informe

| Pendiente | Propuesta | Estado |
|---|---|---|
| Significado de `cobertura_sistemas` | Número de sistemas (equipos) distintos que cubre el plan, no un porcentaje. En la base de datos: `1 ≤ system_coverage ≤ total_task_count` | **Acordada** |
| Porcentajes por tipo | Se redondean al entero más cercano (los empates suben) y la suma de los tres enteros debe estar entre 99 y 101. En la base de datos: `BETWEEN 99 AND 101`. Si un tipo no tiene tareas suficientes, el hueco se completa con el tipo más rezagado | **Acordada (Fase 4)** |
| Criterios de equilibrio (consulta 5) | Plan equilibrado si la desviación entre el % real y el solicitado por tipo es ≤ 10 puntos y ningún equipo concentra más de un X % de las tareas (X por definir) | Propuesta |
| Doble asignación | La evita el administrador al asignar; la base de datos solo impide dos planes para un operario en la misma fecha (PK `(id_operator, assignment_date)`) | **Acordada** |
| Baja de un operario | Se le desasigna automáticamente de todos los planes no finalizados (todos menos `completed`); no se restituyen al reactivarlo | **Acordada** |
| Política de autorización por línea | Se guarda en la tabla `line_authorization` y se consulta con `AuthorizationPolicy` (ver `seguridad-y-usuarios.md`) | **Acordada (Fase 2)** |
| Duplicados semánticos de tareas | Comparar el texto normalizado (minúsculas, sin tildes, espacios colapsados) por equipo y tipo | **Acordada (Fase 3)** |
| Cumplimiento | Intervenciones «cumplida» / intervenciones registradas | Propuesta |
| Plan rechazado | Se conserva como registro con estado `rejected`; se desasigna a todos sus operarios y no admite más cambios (estado final) | **Acordada (Fase 4)** |
| Eliminación de usuarios | No se eliminan: se desactivan con `users.is_active`. Las FK `id_user` de los perfiles son `NOT NULL` y `RESTRICT`; no hay endpoint de borrado | **Acordada** |
| Gestión de líneas, equipos y asignaciones de operarios | Solo el administrador | **Acordada (Fase 3)** |
| Hash de contraseñas (Fase 2) | `bcrypt` directo con SHA-256 previo (sin `passlib`) | **Acordada (Fase 2)** |

## Contrato con el frontend

- El contrato de la API es `/openapi.json`; los cambios que rompan endpoints publicados se avisan.
- Autenticación: cabecera `Authorization: Bearer <token>`.
- Errores: cuerpo `{"detail": "..."}` (formato por defecto de FastAPI).
- CORS: orígenes configurables con la variable `CORS_ORIGINS`.
