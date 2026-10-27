# Arquitectura del frontend

Aplicación React Router 8 (SSR) para la gestión de mantenimiento industrial. Este
documento explica las capas, los patrones aplicados, el flujo de datos y las
decisiones tomadas para poder mantener el código sin conocer cada pantalla.

## 1. Capas

```
app/
├─ routes/        Entradas de React Router (meta + guardas por permiso)
├─ pages/         Pantallas: componen UI, leen el contexto y aplican reglas de presentación
├─ components/    Componentes compartidos y diálogos de dominio
│  └─ maintenance/
├─ data/          Puerta de acceso a datos, proveedor y adaptadores
├─ auth/          Sesión, cuentas demo y guarda de rutas
├─ types/         Modelo de dominio compartido por UI y servicios
├─ utils/         Reglas de negocio puras y matriz de permisos (testeables con Node)
├─ styles/        Extensiones visuales sobre el CSS base
└─ app.css        Tokens y estilos base importados del prototipo de referencia
```

Flujo de una acción:

```
Pantalla → useMaintenance() → MaintenanceContext → maintenance (fábrica)
        → MaintenanceRepository → DemoMaintenanceService | ApiMaintenanceService
        → datos actualizados → contexto → pantalla
```

Las pantallas **no** conocen `fetch` ni los datos simulados. Solo dependen de la
interfaz `MaintenanceRepository` y de las acciones expuestas por el contexto.

## 2. Patrones de diseño aplicados

### 2.1 Repository (puerto) + Strategy (implementaciones)

**Problema.** El front debe funcionar con datos simulados mientras el backend no
está listo y, después, consumir la API real sin reescribir las pantallas.

**Contexto y ubicación.**
- Puerto: `app/data/MaintenanceRepository.ts` (`interface MaintenanceRepository`).
- Estrategia local: `app/data/DemoMaintenanceService.ts`.
- Estrategia remota: `app/data/ApiMaintenanceService.ts`.

**Aplicación.** `MaintenanceContext` depende únicamente del puerto. Cada
implementación decide cómo resolver las operaciones (memoria o HTTP). La UI
invoca acciones de dominio (`createTask`, `reviewDuplicate`, `savePlan`, etc.) y
no distingue la fuente.

**Justificación.** Permite avanzar el front en paralelo con el back, cambiar de
fuente en tiempo de ejecución y sustituir la demo por pruebas sin tocar páginas.
También concentra reglas de integridad (duplicados, una asignación activa por
operario) en un único lugar.

### 2.2 Factory + Adapter

**Problema.** Seleccionar la implementación correcta según el entorno y aislar
los detalles del transporte.

**Contexto y ubicación.**
- Fábrica: `createMaintenanceService()` en `app/data/index.ts`.
- Adaptador REST: `ApiMaintenanceService`, que traduce `fetch`, códigos HTTP y
  cuerpos de error a `MaintenanceError` con un mensaje apto para la UI.

**Aplicación.** La fábrica lee `VITE_API_URL` y la preferencia
`mantenia.data-source`; devuelve una única instancia del repositorio. El
adaptador REST implementa el mismo contrato que la demo, incluyendo `204 No
Content` y errores `{ message }`.

**Justificación.** Evita condicionales de transporte dispersos, permite cambiar
de estrategia sin recompilar la UI y mantiene un contrato explícito verificable
por TypeScript.

### 2.3 Provider + Context

**Problema.** Muchas pantallas comparten sesión, datos, búsqueda global y avisos.

**Contexto y ubicación.**
- `AuthProvider` (`app/auth/AuthContext.tsx`) restaura la sesión de
  `localStorage` y expone `signIn`/`signOut`.
- `MaintenanceProvider` (`app/data/MaintenanceContext.tsx`) carga el repositorio
  una vez, expone acciones que refrescan los datos y publica toasts.
- `useAuth()` y `useMaintenance()` fallan de forma explícita si se usan fuera de
  su proveedor.

**Justificación.** Un único punto de carga y de invalidación evita estados
duplicados y mantiene coherentes las pantallas tras cada mutación.

### 2.4 Guard / matriz de permisos

**Problema.** Restringir vistas y acciones según el rol sin repetir condiciones.

**Contexto y ubicación.**
- `app/utils/permissions.mjs`: matriz `ROLE_PERMISSIONS` y mapa
  `ROUTE_PERMISSIONS`.
- `app/auth/PermissionGate.tsx`: redirige a `/login` sin sesión, muestra 403 sin
  permiso y espera la restauración de la sesión.
- `AppShell` filtra la navegación con `hasPermission`; las páginas ocultan
  acciones no autorizadas.

**Justificación.** Una sola fuente de verdad para roles, navegación, rutas y
botones. La matriz es pura y está cubierta por pruebas.

### 2.5 Núcleo funcional puro

**Problema.** Las reglas de negocio deben probarse sin navegador ni servidor.

**Contexto y ubicación.** `app/utils/maintenanceRules.mjs` contiene detección de
duplicados, parámetros de generación, cálculo de equilibrio, conflicto de
operario, alcance por rol, filtros, ordenamiento y reportes. Las firmas están
declaradas en `maintenanceRules.d.mts` para consumo tipado.

**Justificación.** Node ejecuta las pruebas directamente (`node --test`), sin
transpilación, y las mismas funciones se reutilizan en la demo, la API (cuando
el back las replique) y la UI.

## 3. Rutas y protección

| Ruta | Pantalla | Permiso |
| --- | --- | --- |
| `/login` | Autenticación | Pública |
| `/` | Resumen | `dashboard:view` |
| `/planes` | Planes y revisión | `plans:view` |
| `/tareas` | Banco de tareas y duplicados | `tasks:view` |
| `/lineas` | Líneas y equipos | `catalogs:view` |
| `/tecnicos` | Técnicos | `catalogs:view` |
| `/operarios` | Operarios | `catalogs:view` |
| `/ejecucion` | Ejecución e intervenciones | `execution:view` |
| `/sensores` | Lecturas de sensores | `sensors:view` |
| `/reportes` | Reportes | `reports:view` |
| `/*` | 404 | Pública dentro del layout |

El layout protegido (`app/routes/app.tsx`) exige sesión y monta
`MaintenanceProvider`. Cada ruta envuelve su pantalla en `PermissionGate`. Si un
rol intenta una URL no permitida, ve una pantalla 403 y puede volver al resumen.

## 4. Modelo y reglas relevantes

- **Tarea**: nombre, sistema/equipo, línea, tipo, criticidad, autor, duración y
  ejecuciones. La clasificación es obligatoria y se valida antes de guardar.
- **Duplicado exacto**: mismo nombre, sistema y línea (normalizados sin
  mayúsculas, tildes ni espacios extra). Al detectarlo, el técnico envía una
  solicitud con motivo; el administrador decide y, si aprueba, se crea la tarea
  con trazabilidad (`duplicateApprovedBy`, `duplicateJustification`).
- **Parámetros de generación**: cantidad total, porcentajes preventivo/
  correctivo/predictivo (deben sumar 100), sistemas cubiertos y equilibrio
  esperado. El plan guarda una copia en `params.target` y la distribución real
  calculada en `params`.
- **Una asignación activa por operario**: al aprobar o iniciar un plan, se
  comprueba que ningún operario tenga otro plan en estado `Aprobado` o `En
  ejecución`. La UI deshabilita operarios en conflicto y el servicio también lo
  rechaza (`OPERATOR_CONFLICT`).
- **Revisión**: el jefe de planta o administrador registra revisor, fecha,
  observaciones y, si devuelve el plan, `rejectionCriteria`.
- **Alcance por rol**: administrador y jefe ven toda la planta; el técnico solo
  las líneas de su perfil; el operario solo los planes donde está asignado.

## 5. Datos simulados y API real

La fábrica elige la fuente así:

1. `VITE_API_URL` debe estar definida para habilitar la API.
2. `mantenia.data-source` en `localStorage` guarda `demo` o `api`.
3. Sin configuración, la aplicación usa `DemoMaintenanceService`.

El selector del menú lateral cambia la fuente y recarga la página. La demo parte
de una copia profunda de `app/data/demoData.ts`, por lo que recargar restaura el
estado inicial. El contrato REST está en [contrato-api.md](./contrato-api.md).

## 6. Pruebas y calidad

```bash
npm test          # reglas de negocio y permisos (node:test)
npm run typecheck # typegen de React Router + TypeScript estricto
npm run build     # build de producción SSR
```

La suite cubre duplicados, validaciones de tareas y parámetros, sugerencia de
selección, equilibrio, conflicto de operario, alcance por rol, filtros,
ordenamiento, reportes, indicadores y la matriz de permisos.

## 7. Decisiones y límites conocidos

- La autenticación es de demostración (cuentas locales + `localStorage`). El
  contrato esperado para el backend está documentado; al integrarlo, `login`
  debe delegar en `POST /auth/login`.
- El adaptador REST asume un único endpoint agregado `GET /maintenance` para
  simplificar la carga inicial. Si el backend pagina, se puede dividir sin
  cambiar las pantallas.
- Los reportes se imprimen a PDF con la impresión del navegador; no se incluye
  una librería de PDF para no añadir peso.
- El estado de la demo vive en memoria; recargar la página lo reinicia.
- Los estilos base provienen del prototipo `mantenimiento-codex`; las
  extensiones propias están en `app/styles/custom.css`.

## 8. Trazabilidad de issues

| Issue | Implementación principal |
| --- | --- |
| #4 | `docs/flujo-github.md`, `.github/pull_request_template.md`, este documento |
| #7 | `routes.ts`, `auth/`, `data/index.ts`, `AppShell` |
| #10 | `auth/`, `pages/LoginPage.tsx`, `utils/permissions.mjs` |
| #12 | `pages/LinesPage.tsx`, `saveLine`/`deleteLine` |
| #14 | `pages/TechniciansPage.tsx`, `saveTechnician` |
| #16 | `pages/OperatorsPage.tsx`, `saveOperator` |
| #18 | `pages/TasksPage.tsx`, `components/TaskDialog.tsx` |
| #20 | `maintenanceRules.mjs`, `TasksPage` (pestaña Duplicados) |
| #22 | `PlanGeneratorDialog`, `validateGenerationParams` |
| #24 | `PlanGeneratorDialog`, `buildPlanParams`, `createPlan` |
| #26 | `visiblePlansFor`, filtros de planes y reportes |
| #28 | `PlanReviewDialog`, `savePlan` |
| #30 | `findOperatorConflict`, `PlanReviewDialog`, `DemoMaintenanceService` |
| #47 | `ReportsPage` reporte 01, `buildAutomaticPlansReport` |
| #51 | `ReportsPage` reporte 03, `buildReviewerReport` |
| #60 | `DataTable`, `sortRows` |
| #69 | Este documento, secciones 2.1–2.5 |
