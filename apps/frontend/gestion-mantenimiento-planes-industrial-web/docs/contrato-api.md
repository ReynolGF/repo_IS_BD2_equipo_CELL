# Contrato de la API de mantenimiento

El front consume la API a través de `ApiMaintenanceService`, que implementa el
mismo puerto que los datos simulados. Este documento es la referencia para el
equipo de backend.

## 1. Configuración

```bash
# apps/frontend/gestion-mantenimiento-planes-industrial-web/.env
VITE_API_URL=http://localhost:8000/api
```

- Sin `VITE_API_URL`, el front arranca con datos simulados.
- Con `VITE_API_URL`, el selector **Fuente** del menú lateral permite alternar
  entre `demo` y `api`; la preferencia se guarda en `localStorage`
  (`mantenia.data-source`).
- La URL no debe terminar en `/`; el adaptador la normaliza si ocurre.
- El backend debe permitir CORS para el origen del front (`http://localhost:5173`
  en desarrollo) y aceptar `Content-Type: application/json`.

## 2. Convenciones

- Formato JSON UTF-8.
- Fechas de negocio como `YYYY-MM-DD`; marcas de revisión/intervención como
  cadena local `dd/mm/aaaa, hh:mm` o ISO 8601 (el front solo las muestra).
- Respuestas exitosas: `200` con el recurso o `204` sin cuerpo para borrados.
- Errores: código HTTP no exitoso y cuerpo `{ "message": "Texto para el usuario" }`.
- El adaptador convierte cualquier error HTTP en `MaintenanceError` con el
  mensaje recibido.
- Los identificadores son cadenas (`T-015`, `PM-2026-019`, `LIN-04`, etc.).

## 3. Modelo de datos

### `Task`

```ts
type Task = {
  id: string;
  name: string;
  system: string;
  line: string;
  type: "Preventivo" | "Correctivo" | "Predictivo";
  severity: "Alta" | "Media" | "Baja";
  author: string;
  duration: number;          // minutos
  timesExecuted: number;
  createdAt?: string;
  duplicateApprovedBy?: string;
  duplicateJustification?: string;
};
```

### `Plan`

```ts
type Plan = {
  id: string;
  name: string;
  line: string;
  process: string;
  creator: string;
  reviewer?: string;
  createdAt: string;
  validatedAt?: string;
  observations?: string;
  rejectionCriteria?: string;
  status:
    | "Borrador"
    | "En revisión"
    | "Aprobado"
    | "En ejecución"
    | "Finalizado"
    | "Rechazado";
  params: {
    total: number;
    preventive: number;   // % real
    corrective: number;   // % real
    predictive: number;   // % real
    systems: string[];
    balance: number;      // 0..100
    target: {             // copia de lo configurado al generar
      total: number;
      preventive: number;
      corrective: number;
      predictive: number;
    };
  };
  tasks: (Task & { operator: string; completed: boolean })[];
};
```

### `MaintenanceData` (respuesta agregada)

```json
{
  "tasks": [],
  "plans": [],
  "lines": [],
  "technicians": [],
  "operators": [],
  "interventions": [],
  "sensors": [],
  "duplicateRequests": []
}
```

- `lines[]`: `{ id, name, process, systems: string[], equipment: [{ id, name, system }] }`
- `technicians[]`: `{ id, name, specialty, lines: string[], canValidate: boolean }`
- `operators[]`: `{ id, name, age, shift, lines: string[] }`
- `interventions[]`: `{ id, planId, task, operator, date, notes, result, reinspection, supportTechnician? }`
- `sensors[]`: `{ equipment, line, period, temperature, vibration, pressure, status }`
- `duplicateRequests[]`: ver sección 5.

## 4. Endpoints

### Carga inicial

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| GET | `/maintenance` | — | `MaintenanceData` |

El front tolera que `duplicateRequests` falte y lo reemplaza por `[]`.

### Banco de tareas

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/tasks` | `NewTaskInput` | `Task` (201) |
| PUT | `/tasks/:id` | `Task` | `Task` |
| DELETE | `/tasks/:id` | — | `204` |

`NewTaskInput` es una tarea sin `id`, `timesExecuted`, `createdAt` ni campos de
autorización de duplicado.

Reglas que el backend debe replicar:

- Nombre, sistema y línea son obligatorios; tipo y criticidad deben pertenecer a
  los enums.
- Duración > 0.
- No se permite otra tarea con el mismo nombre + sistema + línea salvo que esté
  autorizada como duplicado.
- No se elimina una tarea que pertenece a un plan (`409`).

### Solicitudes de duplicado

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/duplicate-requests` | `{ draft: NewTaskInput, reason: string, requestedBy: string }` | `DuplicateRequest` |
| PUT | `/duplicate-requests/:id/review` | `{ status: "Aprobada" \| "Rechazada", reviewer: string, notes: string }` | `DuplicateRequest` |

```ts
type DuplicateRequest = {
  id: string;
  draft: NewTaskInput;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: "Pendiente" | "Aprobada" | "Rechazada";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdTaskId?: string;
};
```

- Solo se revisa una solicitud `Pendiente` (`409` si ya fue revisada).
- Al aprobar se crea la tarea y se devuelve `createdTaskId`.
- No se admite otra solicitud pendiente para la misma combinación nombre +
  sistema + línea.

### Líneas y equipos

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/lines` | `ProductionLine` sin `id` | `ProductionLine` |
| PUT | `/lines/:id` | `ProductionLine` | `ProductionLine` |
| DELETE | `/lines/:id` | — | `204` |

- Nombre y proceso obligatorios; al menos un sistema.
- Nombre de línea único.
- No se elimina una línea con tareas, planes o personal asignado (`409`).

### Técnicos

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/technicians` | `Technician` sin `id` | `Technician` |
| PUT | `/technicians/:id` | `Technician` | `Technician` |
| DELETE | `/technicians/:id` | — | `204` |

- Nombre y especialidad obligatorios; al menos una línea autorizada.
- No se elimina un técnico que creó planes (`409`).

### Operarios

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/operators` | `Operator` sin `id` | `Operator` |
| PUT | `/operators/:id` | `Operator` | `Operator` |
| DELETE | `/operators/:id` | — | `204` |

- Nombre y turno obligatorios; edad ≥ 18; al menos una línea.
- No se elimina un operario con un plan activo (`409`).

### Planes

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/plans/generate` | `NewPlanInput` | `Plan` (201) |
| PUT | `/plans/:id` | `Plan` | `Plan` |

`NewPlanInput`:

```ts
{
  name: string;
  line: string;
  process: string;
  creator: string;
  params: Plan["params"];
  tasks: (Task & { operator: string; completed: boolean })[];
}
```

Reglas que el backend debe replicar:

- Parámetros válidos: total entero ≥ 1, porcentajes 0..100 que sumen 100, al
  menos un sistema, equilibrio 1..100.
- Todas las tareas deben pertenecer a la línea del plan.
- El plan se crea en estado `En revisión` con operario `Sin asignar` y tareas
  pendientes.
- Al pasar a `Aprobado` o `En ejecución`, ningún operario puede tener otro plan
  activo (`409 OPERATOR_CONFLICT`).
- La aprobación/devolución guarda `reviewer`, `validatedAt`, `observations` y,
  si aplica, `rejectionCriteria`.

### Intervenciones

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/interventions` | `Omit<Intervention, "id">` | `Intervention` |
| PUT | `/interventions/:id` | `Intervention` | `Intervention` |

Una intervención registra tarea, operario, fecha, notas, resultado y si requiere
reinspección. La asignación de apoyo se guarda en `supportTechnician`.

## 5. Códigos de error sugeridos

| Código | `message` de ejemplo |
| --- | --- |
| `400` | Datos incompletos o parámetros inválidos |
| `404` | El recurso no existe |
| `409 DUPLICATE_TASK` | Ya existe una tarea con ese nombre, sistema y línea |
| `409 DUPLICATE_REQUEST_EXISTS` | Ya hay una solicitud pendiente para esa tarea |
| `409 OPERATOR_CONFLICT` | El operario ya tiene asignado el plan PM-... |
| `409 TASK_IN_USE` | La tarea pertenece a un plan |
| `409 LINE_IN_USE` | La línea tiene tareas, planes o personal |
| `409 TECHNICIAN_IN_USE` | El técnico creó planes |
| `409 OPERATOR_IN_USE` | El operario tiene un plan activo |
| `401/403` | Sesión inválida o rol sin permiso |

## 6. Autenticación (pendiente de integración)

La versión actual usa cuentas de demostración en `app/auth/authService.ts` y
guarda la sesión en `localStorage`. El contrato previsto para el backend es:

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` | `{ token, user: SessionUser }` |

```ts
type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "Administrador" | "Técnico" | "Operario" | "Jefe de planta";
  lines: string[];
  technicianId?: string;
  operatorId?: string;
};
```

Al integrarlo, el adaptador debe enviar `Authorization: Bearer <token>` en las
demás solicitudes y `AuthContext` debe restaurar la sesión desde el token. Los
permisos de la UI son una ayuda de navegación: el backend siempre debe validar el
rol y el alcance por línea.
