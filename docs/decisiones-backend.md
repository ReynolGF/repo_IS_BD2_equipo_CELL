# Decisiones del backend

Este documento registra las decisiones técnicas y las reglas de negocio que el informe de diseño
deja pendientes. Las filas marcadas **Propuesta** deben discutirse y confirmarse en equipo antes de
la Fase 4 (generador de planes) y la Fase 7 (reportes).

## Decisiones técnicas

| Tema | Decisión | Estado |
|---|---|---|
| Framework | FastAPI + Pydantic v2 | Acordada |
| Acceso a datos | SQLAlchemy 2.0 **síncrono** + `psycopg` 3; `pymongo` síncrono; `redis-py` síncrono | Acordada |
| Migraciones | Alembic | Acordada |
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
| Significado de `cobertura_sistemas` | Porcentaje de equipos de la línea con al menos una tarea en el plan | Propuesta |
| Porcentajes por tipo | Se cumplen con tolerancia (±10 puntos); se redondea y se completa con el tipo de mayor déficit | Propuesta |
| Criterios de equilibrio (consulta 5) | Plan equilibrado si la desviación entre el % real y el solicitado por tipo es ≤ 10 puntos y ningún equipo concentra más de un X % de las tareas (X por definir) | Propuesta |
| Doble asignación | Un plan por operario por fecha (PK `(id_operario, fecha_asignacion)`) | Propuesta |
| Política de autorización por línea | Definir dónde se guarda (tabla de configuración o regla por especialidad) | **Por decidir** |
| Duplicados semánticos de tareas | Normalizar antes de guardar: minúsculas, sin tildes, espacios colapsados | Propuesta |
| Cumplimiento | Intervenciones «cumplida» / intervenciones registradas | Propuesta |
| Plan rechazado | Se conserva con estado `rechazado` | Propuesta |
| Hash de contraseñas (Fase 2) | `passlib` tiene problemas con versiones recientes de `bcrypt`; evaluar `bcrypt` directo o `pwdlib` | **Por decidir** |

## Contrato con el frontend

- El contrato de la API es `/openapi.json`; los cambios que rompan endpoints publicados se avisan.
- Autenticación: cabecera `Authorization: Bearer <token>`.
- Errores: cuerpo `{"detail": "..."}` (formato por defecto de FastAPI).
- CORS: orígenes configurables con la variable `CORS_ORIGINS`.
