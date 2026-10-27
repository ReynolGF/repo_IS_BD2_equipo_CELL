# Roles, cuentas demo y guía de uso

## 1. Cuentas de demostración

Todas comparten la contraseña **`demo1234`**. En `/login` también hay botones de
acceso rápido para cada perfil.

| Correo | Nombre | Rol | Líneas |
| --- | --- | --- | --- |
| `elena@mantenia.demo` | Elena Vargas | Administrador | Toda la planta |
| `roberto@mantenia.demo` | Roberto Salas | Jefe de planta | Toda la planta |
| `laura@mantenia.demo` | Laura Méndez | Técnico | Envasado A · Llenado 02 |
| `ana@mantenia.demo` | Ana Gómez | Operario | Envasado A |

La sesión se guarda en `localStorage` (`mantenia.session`). **Cerrar sesión** está
en el botón `⎋` del perfil, al pie del menú lateral.

## 2. Matriz de permisos

| Acción / ruta | Administrador | Jefe de planta | Técnico | Operario |
| --- | :---: | :---: | :---: | :---: |
| Resumen (`/`) | ✓ | ✓ | ✓ | ✓ |
| Consultar planes (`/planes`) | ✓ | ✓ | ✓ (sus líneas) | — |
| Generar plan | ✓ | — | ✓ (sus líneas) | — |
| Revisar/aprobar/devolver plan | ✓ | ✓ | — | — |
| Iniciar plan | ✓ | ✓ | ✓ | — |
| Consultar banco de tareas | ✓ | ✓ | ✓ (sus líneas) | — |
| Crear/editar tareas | ✓ | — | ✓ (crear) | — |
| Revisar duplicados | ✓ | — | — | — |
| Líneas, técnicos y operarios | ✓ (gestiona) | ✓ (consulta) | ✓ (consulta) | — |
| Ejecución e intervenciones | ✓ | ✓ (consulta) | ✓ | ✓ (sus tareas) |
| Sensores (`/sensores`) | ✓ | ✓ | ✓ (sus líneas) | — |
| Reportes (`/reportes`) | ✓ | ✓ | ✓ (sus líneas) | ✓ |

La fuente de verdad es `app/utils/permissions.mjs`. La navegación, las guardas de
ruta y los botones usan la misma matriz. Si se intenta una URL sin permiso se
muestra una pantalla **403**; sin sesión se redirige a `/login`.

## 3. Recorridos sugeridos por rol

### Administrador — Elena

1. **Líneas y equipos**: crear o editar una línea, sus sistemas y equipos.
2. **Técnicos**: registrar especialidad, líneas autorizadas y si puede validar.
3. **Operarios**: registrar turno y líneas; consultar su plan activo.
4. **Banco de tareas**: agregar una tarea y revisar la pestaña **Duplicados**.
5. **Planes**: generar un plan y validarlo (también puede hacerlo el jefe).

### Jefe de planta — Roberto

1. **Planes**: pulsar **Validar plan** o **Validar** en un plan `En revisión`.
2. Revisar parámetros y tareas; elegir operario (los ocupados aparecen
   deshabilitados) y aprobar, o devolver con criterios.
3. Comprobar que el plan queda `Aprobado` con revisor, fecha y observaciones.
4. **Reportes** → *Validaciones por revisor* para ver el historial.

### Técnico — Laura

1. **Planes**: solo ve Envasado A y Llenado 02. Puede generar un plan con las
   tareas elegibles de esas líneas.
2. **Banco de tareas**: solo ve tareas de sus líneas. Si intenta crear una tarea
   con el mismo nombre + sistema + línea, el formulario muestra el duplicado y
   solicita un motivo para enviarlo a revisión.
3. **Ejecución**: consulta y marca tareas de sus planes.

### Operario — Ana

1. **Resumen**: indicadores y tareas asignadas.
2. **Ejecución**: solo sus tareas. Puede marcarlas como completadas y solicitar
   una reinspección.
3. **Reportes**: consulta el alcance de sus planes; no puede imprimir acciones
   de administración.

## 4. Flujos clave

### Evitar duplicados (#20)

- Se consideran iguales el nombre, el sistema y la línea, sin distinguir
  mayúsculas, tildes ni espacios externos.
- Al escribir, el formulario muestra coincidencias parecidas como aviso.
- Si la coincidencia es exacta, el botón cambia a **Solicitar revisión** y exige
  un motivo. La tarea no se crea.
- El administrador ve la solicitud en **Banco de tareas → Duplicados**, con las
  tareas coincidentes y notas. Al aprobar se crea la tarea con trazabilidad; al
  rechazar se conserva el historial.

### Generar un plan (#22, #24)

1. **Planes → Generar plan**.
2. Elegir línea y técnico creador autorizado.
3. Configurar cantidad total, porcentajes (deben sumar 100), equilibrio esperado
   y sistemas cubiertos.
4. Seleccionar exactamente la cantidad de tareas o usar **Sugerir selección**.
5. Generar. El plan se crea en `En revisión` y guarda creador, fecha, tareas,
   distribución real (`params`) y copia de la configuración (`params.target`).

### Revisar y devolver (#28)

- **Aprobar** exige un operario sin otro plan activo; asigna ese operario a todas
  las tareas, registra revisor y fecha.
- **Devolver con criterios** exige el texto de los criterios, deja el plan en
  `Rechazado` y guarda las observaciones.

### Una asignación por operario (#30)

- Un operario puede tener como máximo un plan en estado `Aprobado` o `En
  ejecución`.
- La regla se aplica en la UI (opciones deshabilitadas y mensaje) y en el
  servicio (`OPERATOR_CONFLICT`), por lo que no depende solo del navegador.
- **Operarios** muestra el plan activo de cada persona y cuántos están
  disponibles.

### Ejecución (#30 y siguientes)

- El operario marca tareas; cada cambio guarda una intervención con fecha,
  notas y resultado.
- **Solicitar reinspección** registra la solicitud sin completar la tarea.
- El historial permite asignar un técnico de apoyo de la línea y registrar el
  resultado manual de la reinspección.

### Reportes (#47, #51, #60)

- **Reporte 01** filtra por línea e incluye creador, fecha, distribución,
  sistemas y equilibrio.
- **Reporte 03** filtra por revisor e incluye fecha de validación y
  observaciones.
- Los encabezados de columna ordenan ascendente/descendente (indicador `↕`, `↑`,
  `↓`).
- **PDF** abre la impresión del navegador; se puede guardar como PDF.

## 5. Fuente de datos

- Por defecto: **Datos simulados** (en memoria).
- Para usar la API: crear `.env` con `VITE_API_URL=http://localhost:8000/api` y
  elegir **API real** en el selector **Fuente** del menú lateral.
- Cambiar de fuente recarga la página. La preferencia se guarda en
  `localStorage` (`mantenia.data-source`).
- Recargar con datos simulados restaura el estado inicial de la demo.

El contrato REST está en [contrato-api.md](./contrato-api.md).

## 6. Verificación rápida

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Rutas para probar permisos:

- Como Laura (Técnico): `/tecnicos` y `/operarios` se pueden consultar, pero no
  aparecen botones de edición; `/planes` solo muestra sus líneas; `/tareas` solo
  tareas de Envasado A y Llenado 02.
- Como Ana (Operario): `/planes` debe mostrar 403 y `/ejecucion` solo sus tareas.
- Como Roberto (Jefe): puede validar planes, pero no aparece **Generar plan** ni
  **Agregar tarea**.
- Sin sesión: cualquier ruta protegida redirige a `/login`.
