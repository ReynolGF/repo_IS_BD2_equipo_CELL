# Contrato de la API: ejecución, sensores y reportes

Complementa `contrato-api.md` (que describe catálogos, tareas y planes). Estos son los endpoints que usan
las pantallas con `loader`/`action` de React Router (ejecución, reinspecciones, sensores y cuatro reportes),
a través de los repositorios de `app/repositories/`.

- Los campos van en `snake_case`; las fechas, en ISO 8601 sin zona (`2026-10-26T08:15:00`).
- Una regla de negocio incumplida responde `422` con `{ "detail": "mensaje en español" }`; un recurso que no
  existe, `404`.
- Los tipos exactos están en `app/types/operacion.ts` y `app/types/reporte.ts`; los datos de ejemplo, en
  `app/mocks/` (derivados de `app/data/demoData.ts`).
- Si `VITE_API_URL` termina en `/api`, estos repositorios lo normalizan y añaden `/api/...` ellos mismos.

> **Pendiente de acordar con el backend:** `contrato-api.md` usa otras rutas y otro modelo (campos en inglés,
> carga agregada). Antes de conectar la API real hay que decidir un único contrato; hoy las dos capas de datos
> (`app/data` y `app/repositories`) siguen caminos distintos.

## Ejecución de planes

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/operarios` | Operarios para el selector | `OperarioResumen[]` |
| `GET /api/operarios/{id}/planes` | Planes donde el operario tiene tareas | `PlanAsignado[]` (404 si no existe) |
| `GET /api/planes?estado=aprobados` | Planes aprobados para el selector | `PlanResumen[]` |
| `GET /api/planes/{id}/estado-ejecucion` | Plan con el estado de cada tarea | `PlanAsignado` (404) |
| `GET /api/intervenciones?plan_id=` | Historial (el filtro es opcional) | `Intervencion[]`, de la más reciente a la más antigua |
| `POST /api/intervenciones` | Registra una intervención | `Intervencion` (201) |

```json
{ "plan_id": 18, "tarea_id": 8, "operario_id": 1, "resultado": "cumplida", "observaciones": "Banda sustituida." }
```

Reglas: observaciones de 5 a 500 caracteres; la tarea debe ser del operario; una tarea `cumplida` no admite
otra intervención; el plan pasa a `en_ejecucion` con la primera intervención y a `finalizado` cuando no quedan
tareas `pendiente`.

## Reinspecciones

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/tecnicos` | Técnicos y sus líneas | `TecnicoResumen[]` |
| `GET /api/reinspecciones` | Solicitudes, las pendientes primero | `SolicitudReinspeccion[]` |
| `POST /api/reinspecciones` | Solicitud del operario | `SolicitudReinspeccion` (201) |
| `PATCH /api/reinspecciones/{id}/apoyo` | Pide un técnico de apoyo (`{ "tecnico_id": 3 }`) | `SolicitudReinspeccion` |
| `POST /api/reinspecciones/{id}/resultado` | Registra la reinspección manual y cierra la solicitud | `SolicitudReinspeccion` |

```json
// POST /api/reinspecciones
{ "intervencion_id": 3, "motivo": "La vibración sigue alta.", "tecnico_apoyo_id": 2 }
// POST /api/reinspecciones/1/resultado
{ "participantes": ["Laura Méndez", "Ana Gómez"], "observaciones": "Sello reemplazado.", "resultado": "conforme" }
```

Reglas: motivo y observaciones de 5 a 500 caracteres; no puede haber dos solicitudes `pendiente` para la misma
intervención; una solicitud `completada` no admite apoyo ni un segundo resultado; hace falta al menos un
participante. El técnico asignado es el que creó el plan.

## Sensores

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/equipos` | Equipos con sensores | `EquipoResumen[]` |
| `GET /api/sensores/analisis?periodo=24h&linea_id=&equipo_id=` | Mínimo, promedio y máximo por equipo y magnitud (`periodo`: `24h`, `7d` o `30d`) | `AnalisisSensores` |
| `GET /api/equipos/estado-operativo?linea_id=` | Última lectura y estado (`normal`, `alerta`, `critico`) | `EstadoEquipo[]` |

El histórico completo de lecturas no viaja al navegador: el backend lo agrega.

## Reportes

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/lineas` | Líneas para los selectores | `LineaProduccion[]` |
| `GET /api/lineas/{id}/tareas-mas-ejecutadas` | Tareas por número de ejecuciones (mayor a menor; empate por nombre) | `ReporteTareasMasEjecutadas` (404) |
| `GET /api/planes` | Todos los planes para el selector | `PlanResumen[]` |
| `GET /api/planes/{id}/desempeno-operarios` | Tareas asignadas y cumplidas por operario y criticidad | `ReporteDesempenoOperarios` (404) |
| `GET /api/analisis/cumplimiento` | Correlación criticidad-rendimiento por línea, las 10 tareas más incumplidas y reinspecciones frente al turno | `ReporteAnalisisCumplimiento` |
| `GET /api/analisis/distribucion-lineas` | Tareas por línea, sistema y criticidad, y criterio de equilibrio | `ReporteDistribucionLineas` |

`cumple_criterio` es `true` cuando `porcentaje_equilibrio >= minimo_requerido`. La tasa de cumplimiento es
`cumplidas / asignadas * 100`.

## Alcance por rol

Con datos simulados el recorte por rol se hace en el navegador (`app/utils/alcance.ts`). **La API debe aplicar
las mismas reglas**: administrador y jefe de planta ven todo; el técnico, solo sus líneas; el operario, solo sus
propias tareas, intervenciones y solicitudes. El jefe de planta no registra intervenciones; solo el operario
solicita reinspecciones; solo el técnico y el administrador las atienden.
