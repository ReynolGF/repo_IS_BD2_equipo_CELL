# Mantenia · Gestión de mantenimiento industrial (frontend)

Aplicación web para administrar líneas, equipos, técnicos, operarios, banco de
tareas, generación y revisión de planes, ejecución, sensores y reportes de
mantenimiento industrial.

Construida con **React Router 8 (SSR)**, **React 19**, **TypeScript estricto** y
**Tailwind 4**. El diseño parte del prototipo `mantenimiento-codex` y se amplió
con estilos propios en `app/styles/custom.css`.

## Inicio rápido

Requisitos: Node.js 20+ y npm.

```bash
cd apps/frontend/gestion-mantenimiento-planes-industrial-web
npm install
npm run dev
```

Abrir `http://localhost:5173`. La aplicación arranca con **datos simulados**, sin
necesidad de backend.

### Cuentas demo

Contraseña para todas: **`demo1234`**. En `/login` hay acceso rápido con un clic.

| Correo | Rol |
| --- | --- |
| `elena@mantenia.demo` | Administrador |
| `roberto@mantenia.demo` | Jefe de planta |
| `laura@mantenia.demo` | Técnico (Envasado A y Llenado 02) |
| `ana@mantenia.demo` | Operario (Envasado A) |

Detalle de permisos y recorridos: [docs/roles-y-demo.md](docs/roles-y-demo.md).

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (cliente + SSR) |
| `npm start` | Sirve el build de producción |
| `npm test` | Pruebas de reglas de negocio y permisos (`node:test`) |
| `npm run typecheck` | Genera tipos de rutas y ejecuta TypeScript |

Antes de abrir un PR:

```bash
npm test
npm run typecheck
npm run build
```

## Fuente de datos: demo o API

1. Copiar `.env.example` a `.env`.
2. Definir `VITE_API_URL` (por ejemplo `http://localhost:8000/api`).
3. Reiniciar el servidor y elegir **API real** en el selector **Fuente** del menú
   lateral.

Sin `VITE_API_URL` la opción de API aparece deshabilitada y todo funciona con
`DemoMaintenanceService` (estado en memoria; recargar restaura la demo).

El contrato REST está en [docs/contrato-api.md](docs/contrato-api.md).

## Funcionalidades

- Autenticación demo y navegación protegida por rol (Administrador, Jefe de
  planta, Técnico, Operario).
- Catálogo de líneas con procesos, sistemas y equipos.
- Técnicos con especialidad, líneas autorizadas y permiso de validación.
- Operarios con edad, turno, líneas y plan activo.
- Banco de tareas clasificado por sistema, tipo y criticidad.
- Detección de duplicados con revisión y trazabilidad del administrador.
- Generación de planes con cantidad, mezcla, cobertura de sistemas, equilibrio y
  sugerencia de tareas; el plan conserva creador, fecha y parámetros.
- Revisión por jefatura con aprobación, devolución con criterios, observaciones y
  fecha.
- Regla de una sola asignación activa por operario, aplicada en UI y servicio.
- Ejecución de tareas, intervenciones, reinspecciones y técnico de apoyo.
- Lecturas agregadas de sensores por equipo y línea.
- Seis reportes con filtros por línea/revisor, columnas ordenables e impresión a
  PDF.

## Estructura

```
app/
├─ auth/          sesión, cuentas demo y guarda por permiso
├─ components/    AppShell, tablas/diálogos compartidos
├─ data/          puerto del repositorio, demo, API, contexto y fábrica
├─ pages/         pantallas
├─ routes/        entradas de React Router
├─ styles/        extensiones CSS
├─ types/         modelo de dominio
└─ utils/         reglas puras + pruebas + matriz de permisos
docs/             arquitectura, contrato de API, roles y flujo de GitHub
```

## Documentación

- [Arquitectura y patrones de diseño](docs/arquitectura-front.md) — Repository,
  Strategy, Factory, Adapter, Provider y guardas. Incluye trazabilidad de issues.
- [Contrato de la API](docs/contrato-api.md) — endpoints, modelos, errores y
  autenticación prevista.
- [Contrato de la API: ejecución, sensores y reportes](docs/contrato-api-operacion.md) — endpoints de las
  pantallas con loader/action y alcance por rol.
- [Roles y guía de uso](docs/roles-y-demo.md) — permisos, cuentas y flujos.
- [Flujo de trabajo en GitHub](docs/flujo-github.md) — ramas, commits, PR,
  revisión y definición de terminado.
- [Plantilla de pull request](../../../.github/pull_request_template.md).

## Pruebas

`npm test` ejecuta 28 casos sobre:

- Normalización y detección de duplicados (exactos y parecidos).
- Validación de tareas y de parámetros de generación.
- Sugerencia de tareas, distribución real y equilibrio.
- Conflicto de operario y alcance de planes por rol.
- Filtros, ordenamiento, reportes e indicadores.
- Matriz de permisos y acceso por ruta.

## Docker

```bash
docker build -t mantenia-front .
docker run -p 3000:3000 mantenia-front
```

El `Dockerfile` usa el servidor de producción de React Router (`npm start`).


## Pantallas de operación y reportes (Manuel)

Se integran dentro del layout protegido de `app/routes/app.tsx`: aparecen en el menú según el
permiso del rol y `AppShell` muestra el 403 si el rol no tiene acceso a la ruta (la guarda se
aplica por prefijo con `permissionForPath`). Usan `loader`/`action` de React Router y los
repositorios de `app/repositories/` (patrón Repository con datos simulados o API), que son
propios (no usan la capa `app/data`), pero **sus datos simulados se derivan de `app/data/demoData.ts`**
(`app/mocks/desdeDemo.ts`): mismas líneas, operarios, técnicos, tareas, planes, intervenciones y lecturas de
sensores que el resto de la aplicación; solo cambia la forma (ids numéricos y campos en snake_case).

| Ruta | Pantalla | Permiso |
| --- | --- | --- |
| `/ejecucion/operario` | Registrar intervención por tarea | `execution:view` |
| `/ejecucion/estado` | Avance y cumplimiento de un plan | `execution:view` |
| `/reinspecciones` | Solicitud con apoyo y resultado manual | `execution:view` |
| `/sensores/analisis` | Temperatura, vibración y presión por equipo, línea y periodo | `sensors:view` |
| `/sensores/estado` | Estado operativo actual de los equipos | `sensors:view` |
| `/reportes/tareas-mas-ejecutadas` | Reporte de tareas más ejecutadas | `reports:view` |
| `/reportes/desempeno-operarios` | Desempeño de operarios en un plan | `reports:view` |
| `/reportes/analisis-cumplimiento` | Criticidad vs. rendimiento, incumplimientos y reinspecciones | `reports:view` |
| `/reportes/distribucion-lineas` | Distribución de tareas y equilibrio entre líneas | `reports:view` |

`npm test` ejecuta primero las pruebas de reglas y permisos (`node:test`) y luego las de pantallas
y repositorios (Vitest, `npm run test:ui`). `VITE_API_URL` puede terminar en `/api`: los
repositorios de esta sección lo normalizan.

### Alcance por rol en estas pantallas

Reglas puras en `app/utils/alcance.ts`, leídas de la sesión con `useAlcance()` (`app/auth/useAlcance.ts`). Siguen
las mismas reglas que `visiblePlansFor`:

| Rol | Qué ve | Qué puede hacer |
| --- | --- | --- |
| Administrador | Toda la planta | Registrar intervenciones; asignar apoyo y registrar el resultado de una reinspección |
| Jefe de planta | Toda la planta | Solo consultar (no ejecuta) |
| Técnico | Operarios, planes, equipos, reportes y solicitudes de sus líneas | Registrar intervenciones; asignar apoyo y registrar resultados de reinspección (de sus líneas) |
| Operario | Sus líneas; solo sus propias tareas, intervenciones y solicitudes (no hay selector de operario) | Registrar sus intervenciones y solicitar reinspecciones |

Una dirección fuera del alcance (por ejemplo `?plan=16` con un técnico de otras líneas) muestra "Sin acceso", no datos.

> Con datos simulados el recorte se hace en el navegador. Con un backend real la API debe aplicar las mismas
> reglas, porque los `loader` y `action` de estas pantallas no comprueban la sesión.