# Seguridad, usuarios y autorización por línea (Fase 2)

## Resumen

- Inicio de sesión con correo y contraseña; la API entrega un **JWT**.
- Cada petición protegida lleva `Authorization: Bearer <token>`.
- Cuatro roles (`Occupation`): `technician`, `operator`, `plant_manager`, `administrator`.
- **Solo el administrador crea y gestiona usuarios.** No hay registro público.
- Qué técnico puede generar o validar en cada línea se guarda en `line_authorization` y se consulta
  con `AuthorizationPolicy`.

## Cómo se hizo

| Tema | Decisión |
|---|---|
| Hash de contraseñas | `bcrypt` directo (no `passlib`, que da problemas con las versiones recientes de `bcrypt`). Antes de aplicar bcrypt se hace SHA-256 + Base64: bcrypt solo admite 72 bytes y así ninguna contraseña se trunca ni falla |
| Contraseñas | Entre 8 y 128 caracteres |
| Token | JWT HS256 con `sub` (id de usuario), `role` (informativo), `iat` y `exp`. Duración: `ACCESS_TOKEN_EXPIRE_MINUTES` (60 por defecto) |
| Rol efectivo | Se lee **de la base de datos** en cada petición, no del token: un token que afirme otro rol no sirve |
| Cuenta desactivada | Se rechaza en el login (403) y los tokens que ya tenía dejan de valer al instante (401) |
| Mensaje de login | Igual si el correo no existe o la contraseña es incorrecta (401), y con tiempo de respuesta igualado, para no revelar qué correos existen |
| Correos | Se guardan en minúsculas; la unicidad no distingue mayúsculas |
| Falta de token | Siempre 401 con `{"detail": "..."}` (no depende de la versión de FastAPI) |
| Formato de error | `{"detail": "mensaje"}` para 401, 403, 404, 409 y 422 |

Códigos de error de dominio (`app/core/exceptions.py`):

| Excepción | HTTP | Cuándo |
|---|---|---|
| `AuthenticationError` | 401 | Credenciales o token ausentes, inválidos o caducados |
| `PermissionDeniedError` | 403 | Identificado, pero sin permiso |
| `NotFoundError` | 404 | El recurso no existe |
| `ConflictError` | 409 | Duplicado o historial que impide la acción |
| `BusinessRuleError` | 422 | Petición válida que incumple una regla (por ejemplo, desactivarse a sí mismo) |

## Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/login` | Público | `{email, password}` → `{access_token, token_type, expires_in}` |
| `GET /auth/me` | Autenticado | Datos del usuario, con los de su perfil según el rol |
| `POST /auth/change-password` | Autenticado | `{current_password, new_password}` → 204 |
| `POST /users` | Admin | Crea usuario y su subtipo según el rol |
| `GET /users` | Admin | Filtros `occupation`, `is_active`, `q` (nombre o correo); paginación `limit` (1-200) y `offset` |
| `GET /users/{id}` | Admin | Un usuario |
| `PATCH /users/{id}` | Admin | Cambia nombre, correo, contraseña, perfil o `is_active` (baja y reactivación) |
| `GET /lines/{id}/authorizations` | Admin | Técnicos autorizados en la línea |
| `PUT /lines/{id}/authorizations/{id_technician}` | Admin | Concede o actualiza `{can_generate, can_validate}` |
| `DELETE /lines/{id}/authorizations/{id_technician}` | Admin | Quita la autorización |
| `GET /technicians/{id}/authorizations` | Admin | Líneas de un técnico |
| `GET /technicians/me/authorizations` | Técnico | Sus propias líneas |

Campos de perfil al crear un usuario:

| Rol | Obligatorios | No admite |
|---|---|---|
| `technician` | `specialty` | `age`, `shift` |
| `operator` | `age`, `shift` | `specialty` |
| `plant_manager`, `administrator` | ninguno | `specialty`, `age`, `shift` |

El rol de un usuario **no se puede cambiar**; hay que crear otro.

## Dar de baja a un trabajador

**Los usuarios no se eliminan.** No existe ningún endpoint para borrarlos y la base de datos lo
impide (`ON DELETE RESTRICT` en los perfiles). La baja se hace con `PATCH /users/{id}` y
`{"is_active": false}`; se revierte con `{"is_active": true}`.

Un usuario inactivo:

- **No puede iniciar sesión** (403), aunque la contraseña sea correcta.
- **No puede usar sus tokens anteriores** (401 en cualquier endpoint protegido), porque el usuario se
  consulta en la base de datos en cada petición. Tampoco puede reactivarse él mismo.
- **No puede recibir autorizaciones nuevas** y la política de autorización lo trata como si no
  tuviera ninguna.
- **Si es operario, se le desasigna de todos los planes no finalizados** (cualquier estado menos
  `completed`) en la misma transacción. Esos planes quedan sin operario hasta reasignarlos, y
  reactivar al operario no restituye las asignaciones. Sus intervenciones ya registradas no se tocan.
- **Conserva** nombre, correo, perfil e historial. Sus reportes siguen mostrándolo.
- **Sigue ocupando su correo**: no se puede crear otra cuenta con él.

Un administrador no puede desactivar su propia cuenta. Como las acciones solo las hace un
administrador activo, siempre queda al menos uno.

## Política de autorización por línea

Resuelve la decisión pendiente de `decisiones-backend.md`: **la política vive en la tabla
`line_authorization`**, no en una regla fija.

```python
policy = AuthorizationPolicy(db)
policy.can_generate(id_technician, id_line)       # bool
policy.require_validate(id_technician, id_line)   # lanza PermissionDeniedError
policy.technicians_who_can_generate(id_line)      # lista de técnicos
```

- Un técnico **inactivo** nunca puede generar ni validar, aunque conserve su fila.
- La base de datos solo comprueba que la fila exista (clave foránea compuesta de `plan`); que
  `can_generate` sea verdadero lo comprueba esta política. **La Fase 4 debe llamar a
  `require_generate` antes de crear un plan, y `require_validate` antes de validarlo.**
- No se puede quitar la autorización a un técnico que ya creó planes en esa línea (409): la clave
  foránea compuesta protege el historial.

## Dependencias de FastAPI para las fases siguientes

En `app/api/deps.py`:

```python
from app.api.deps import require_admin, require_role, get_current_technician

@router.post("/plans/generate")
def generate(technician: Technician = Depends(get_current_technician), ...): ...

@router.get("/algo")
def algo(user: User = Depends(require_role(Occupation.plant_manager, Occupation.administrator))): ...
```

Hay también `get_current_operator`, `get_current_manager`, `require_technician`, `require_operator`
y `require_manager`.

## Primer administrador

Al principio no existe ninguno y solo un administrador crea usuarios. Con los servicios levantados:

```bash
docker compose exec api python -m app.scripts.create_admin --name "Ana Pérez" --email ana@planta.com
```

Pide la contraseña por consola dos veces. Fuera de Docker, desde `apps/backend` y con el entorno
virtual activado: `python -m app.scripts.create_admin --name ... --email ...`.

## Limitaciones conocidas

- **Sin cierre de sesión en el servidor:** un token vale hasta que caduca. Desactivar la cuenta sí
  lo invalida al instante. Cambiar la contraseña no invalida los tokens ya emitidos.
- **Sin límite de intentos de login.** Si se quiere, `slowapi` o un contador en Redis.
- **`SECRET_KEY`:** el valor por defecto es solo para desarrollo. Usar una cadena aleatoria de al
  menos 32 caracteres en cualquier entorno compartido (PyJWT avisa si es más corta).
  Generarla con: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Un plan rechazado cuenta como «no finalizado»: si su operario se da de baja, también se le
  desasigna de él.
- Las asignaciones de operarios a líneas (`line_assignment`) se administran desde la Fase 3 (ver
  `lineas-equipos-y-tareas.md`).
