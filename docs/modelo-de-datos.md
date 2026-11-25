# Modelo de datos (implementación)

Este documento relaciona el esquema implementado en `apps/backend/app/models/` con el informe de
diseño. **Los nombres del código están en inglés**; el informe usa español.

## Glosario informe → código

| Informe | Tabla | Clase |
|---|---|---|
| USUARIO | `users` | `User` |
| TECNICO / OPERARIO / JEFE_PLANTA / ADMINISTRADOR | `technician` / `operator` / `plant_manager` / `administrator` | `Technician` / `Operator` / `PlantManager` / `Administrator` |
| LINEA_PRODUCCION | `production_line` | `ProductionLine` |
| EQUIPO_SISTEMA | `equipment_system` | `EquipmentSystem` |
| PERTENECE_EQUIPO_LINEA | `equipment_line_membership` | `EquipmentLineMembership` |
| ASIGNADO | `line_assignment` | `LineAssignment` |
| *(no estaba en el informe v3)* | `line_authorization` | `LineAuthorization` |
| TAREA | `task` | `Task` |
| PLAN | `plan` | `Plan` |
| PERTENECE_TAREA_PLAN | `task_plan_membership` | `TaskPlanMembership` |
| ASIGNACION_PLAN_OPERARIO | `plan_operator_assignment` | `PlanOperatorAssignment` |
| REVISION | `revision` | `Revision` |
| VALIDACION | `validation` | `Validation` |
| INTERVENCION | `intervention` | `Intervention` |
| REINSPECCION | `reinspection` | `Reinspection` |

Valores de enumeraciones que cambian de palabra: `finalizado` → `completed`,
`en_ejecucion` → `in_execution`, `cumplida` → `fulfilled`, `incumplida` → `unfulfilled`,
`atendida` → `attended`, `confirmada/corregida/descartada` → `confirmed/corrected/discarded`,
`en_mantenimiento/averiado/detenido` → `under_maintenance/faulty/stopped`.

## Comportamiento de los borrados

Todas las claves foráneas usan `ON DELETE RESTRICT`: **no se puede borrar una fila mientras otra
fila la referencie**. PostgreSQL lo comprueba al instante y lanza un error de clave foránea, que
SQLAlchemy convierte en `IntegrityError`; el servicio debe capturarlo y responder 409.

**Los usuarios no se eliminan.** `technician.id_user`, `operator.id_user`,
`plant_manager.id_user` y `administrator.id_user` son `NOT NULL`, `UNIQUE` y `ON DELETE RESTRICT`,
como el resto del esquema. La base de datos rechaza borrar un `users` que tenga perfil, y por eso
el nombre, el correo y el historial de un trabajador nunca se pierden. La baja de un trabajador se
hace con `users.is_active = FALSE` (ver «Baja de trabajadores»).

Consecuencias:

- No existen subtipos huérfanos: todo técnico, operario, jefe o administrador tiene siempre su
  cuenta, y los reportes pueden usar `JOIN` normal con `users` para mostrar «quién hizo qué».
- El correo de un usuario dado de baja **sigue ocupado**: no se puede reutilizar en otra cuenta.
  Si el trabajador vuelve, se reactiva la misma cuenta.
- La API no ofrece ningún endpoint para eliminar usuarios.
- Un `users` sin ninguna fila de subtipo sí se podría borrar con SQL directo, pero la aplicación
  siempre crea la cuenta junto con su perfil, así que no ocurre.

Qué implica, por ejemplo para un técnico (`technician`):

| Si el técnico tiene… | …la referencia que bloquea el borrado |
|---|---|
| tareas creadas | `task.id_creator_technician` |
| planes creados | `plan.id_creator_technician` |
| validaciones | `validation.id_technician` |
| reinspecciones como apoyo | `reinspection.id_additional_technician` |
| reinspecciones resueltas | `reinspection.id_resolver_technician` |
| autorizaciones en líneas | `line_authorization.id_technician` |

- **Basta una sola dependencia** para bloquear el borrado. Solo se puede borrar un técnico que no
  tenga ninguna fila asociada (por ejemplo, uno recién creado por error).
- Lo mismo vale para el resto: una línea con equipos, operarios, autorizaciones o planes; un equipo
  con tareas o líneas; un plan con tareas, asignaciones, revisiones, validaciones o intervenciones;
  una intervención con reinspecciones.
- Un `users` con perfil **no** se puede borrar, y borrar el perfil (técnico, operario, jefe o
  administrador) también está bloqueado si tiene dependencias.
- Las filas de las tablas puente (`task_plan_membership`, `equipment_line_membership`,
  `line_assignment`, `line_authorization`, `plan_operator_assignment`) **sí** se pueden borrar de
  forma explícita, siempre que nada las referencie. Para eliminar un plan sin historial hay que
  borrar antes sus asociaciones; no ocurre solo.
- `ON UPDATE CASCADE` se conserva en las claves foráneas que lo tenían: si una clave primaria
  cambiara, las referencias se actualizan. Con claves autoincrementales no ocurre en la práctica.

## Baja de trabajadores: `users.is_active`

`users.is_active` (`BOOLEAN NOT NULL`, por defecto `TRUE`) es **la única forma de dar de baja a
alguien**. Desactivar una cuenta conserva su nombre, su correo, su perfil y todo su historial, y se
puede revertir poniendo `is_active = TRUE`.

Qué hace la aplicación con un usuario inactivo:

| Dónde | Comportamiento |
|---|---|
| Login | Rechazado con 403 «La cuenta está desactivada», aunque la contraseña sea correcta |
| Tokens ya emitidos | Dejan de valer al instante (401): `get_current_user` consulta la base de datos en **cada** petición, así que ningún endpoint protegido responde a un usuario inactivo |
| Cambios | Un usuario inactivo no puede crear, modificar ni consultar nada, ni siquiera reactivarse a sí mismo. Solo otro administrador activo puede reactivarlo |
| Autorización por línea | `AuthorizationPolicy` lo trata como si no tuviera permisos, y no se le pueden conceder autorizaciones nuevas |
| Listas de candidatos | Los técnicos y operarios elegibles (generar, validar, recibir planes) excluyen a los inactivos (`JOIN users ... WHERE users.is_active`) |
| Reportes históricos | **No** filtran por `is_active`: deben seguir mostrando a quien hizo cada intervención, validación o plan. Conviene marcar visualmente a los inactivos |

Reglas adicionales:

- Un administrador no puede desactivar su propia cuenta; como solo un administrador activo puede
  actuar, siempre queda al menos uno.
- Al desactivar a un técnico no se tocan sus autorizaciones por línea (la FK compuesta de `plan` las
  necesita para conservar la integridad del historial); basta con que los servicios lo excluyan.
- Los planes ya asignados a un operario inactivo deben reasignarse o cerrarse; qué hacer con ellos
  queda pendiente de decidir.

La migración que añade la columna debe incluir `server_default=sa.true()` para que las filas
existentes queden activas.

## Reglas que NO puede imponer la base de datos (van en los servicios)

- `plan.id_creator_technician` debe tener `can_generate = TRUE` (la FK solo exige que la fila exista).
- Quien valida un plan debe tener `can_validate = TRUE` en la línea del plan.
- Las tareas de un plan deben pertenecer a equipos que cubra la línea.
- Un operario solo recibe planes de líneas en las que está asignado y solo registra intervenciones
  de planes que tiene asignados en esa fecha.
- `cantidad_total_tareas` debe coincidir con el número de tareas del plan y debe haber al menos una.
- Transiciones válidas del estado del plan.

## Migraciones (Alembic)

Desde `apps/backend`, con PostgreSQL levantado (`docker compose up -d postgres`):

```bash
alembic revision --autogenerate -m "esquema inicial"   # genera alembic/versions/xxxx_esquema_inicial.py
# Revisar el archivo generado ANTES de aplicarlo
alembic upgrade head                                   # aplica
alembic downgrade base                                 # deshace todo (solo en desarrollo)
alembic check                                          # falla si los modelos y las migraciones difieren
```

Regla del equipo: **todo cambio en `app/models/` va acompañado de su migración en el mismo PR.**
