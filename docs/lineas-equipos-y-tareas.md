# Líneas, equipos y tareas (Fase 3)

Cubre RF1–RF8, RF37 y RF41 del informe.

## Quién puede qué

| Acción | Administrador | Técnico | Jefe de planta | Operario |
|---|---|---|---|---|
| Crear, modificar y eliminar líneas y equipos | Sí | No | No | No |
| Asociar equipos a líneas; asignar operarios a líneas | Sí | No | No | No |
| Consultar líneas y equipos (con su estado operativo) | Sí | Sí | Sí | Sí |
| Cambiar el estado operativo de un equipo | Sí | Sí | No | No |
| Ver los operarios de una línea | Sí | No | Sí | No |
| Ver sus propias líneas | – | – | – | Sí |
| Crear tareas | No | Sí | No | No |
| Modificar y eliminar tareas | No | Solo las suyas | No | No |
| Ver tareas de otros por línea | Todas | Solo líneas donde está autorizado | Todas | No |

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `POST /lines`, `GET /lines`, `GET /lines/{id}`, `PATCH /lines/{id}`, `DELETE /lines/{id}` | Líneas. `GET` devuelve cada línea con sus equipos (RF3); `DELETE` da 409 si tiene algo asociado |
| `PUT /lines/{id}/equipment/{id_equipment}` | Asocia un equipo a la línea (idempotente) (RF2) |
| `DELETE /lines/{id}/equipment/{id_equipment}` | Quita la asociación |
| `POST /equipment`, `GET /equipment`, `GET /equipment/{id}`, `PATCH /equipment/{id}`, `DELETE /equipment/{id}` | Equipos. Filtros de la lista: `id_line`, `operational_status`, `q`; paginación `limit` y `offset` |
| `PUT /equipment/{id}/status` | `{operational_status}`: actualiza el estado vigente y su fecha (RF41) |
| `GET /lines/{id}/operators` | Operarios asignados a la línea |
| `PUT` y `DELETE /lines/{id}/operators/{id_operator}` | Asigna o quita un operario (RF37) |
| `GET /operators/me/lines`, `GET /operators/{id}/lines` | Líneas de un operario |
| `POST /tasks` | Crea una tarea a nombre del técnico (RF4, RF5) |
| `GET /tasks` | Tareas del técnico autenticado (RF7). Filtros: `id_equipment`, `type`, `criticality_level`, `q` |
| `GET /tasks/{id}` | Una tarea (propia, de una línea donde el técnico está autorizado, o cualquiera si es administrador o jefe) |
| `PATCH /tasks/{id}`, `DELETE /tasks/{id}` | Solo el técnico que la creó (RF7) |
| `GET /lines/{id}/tasks` | Tareas de los equipos de la línea, de cualquier técnico (RF8). Filtros además: `id_creator_technician` |

Las listas devuelven `{items, total, limit, offset}`.

## Anti-duplicados (RF6)

Dos tareas son la misma si coinciden en **equipo, tipo y descripción normalizada**: minúsculas,
sin tildes ni diéresis (la ñ cuenta como n) y espacios colapsados. «Revisar  Rodamiento» y
«revisár rodamiento» son la misma tarea y la segunda recibe 409 con el id de la existente.
Aplica aunque la cree otro técnico. Las descripciones distintas por una palabra
(«rodamiento» / «rodamientos») no se consideran iguales: no hay detección por similitud.

La restricción única de la base de datos (`uq_task_equipment_type_desc`) sigue siendo la última
defensa si dos peticiones idénticas llegan a la vez.

## Decisiones tomadas en esta fase

Las filas marcadas **Propuesta** deben confirmarse en equipo.

| Tema | Decisión | Estado |
|---|---|---|
| Quién administra líneas, equipos y asignaciones de operarios | Solo el administrador | **Acordada** |
| Quién crea tareas | Cualquier técnico activo, sobre cualquier equipo (no hace falta autorización en una línea) | Propuesta |
| Estado operativo | Lo cambian técnicos y administradores; la fecha solo se actualiza si el estado cambia | Propuesta |
| Borrado de líneas, equipos y tareas | Permitido solo si nada depende de ellos (RESTRICT → 409). Las líneas y equipos con historial no se pueden borrar | Propuesta |
| Operarios dados de baja | No se pueden asignar a líneas; sus asignaciones a líneas se conservan. Se les desasigna de todos los planes no finalizados (ver `seguridad-y-usuarios.md`) | **Acordada** (planes) / Propuesta (líneas) |
| Quitar un equipo de una línea | Permitido siempre; no borra tareas ni planes existentes | Propuesta |

## Pendiente para fases posteriores

- **Fase 4:** al generar un plan, usar solo tareas de equipos de la línea del plan
  (`GET /lines/{id}/tasks` ya refleja esa regla) y llamar a `AuthorizationPolicy.require_generate`.
- **Fase 6:** al cambiar el estado operativo, actualizar la caché de Redis (hay un comentario en
  `services/lines.py::update_status` donde irá).
- Las operaciones de asignación de operarios a planes llegan en la Fase 5.
