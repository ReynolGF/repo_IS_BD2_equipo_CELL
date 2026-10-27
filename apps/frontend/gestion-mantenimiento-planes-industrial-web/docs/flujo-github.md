# Flujo de trabajo en GitHub

Convenciones del equipo para registrar cambios y revisar contribuciones. Aplican
a todo el repositorio y, en particular, al front de mantenimiento.

## 1. Estructura inicial documentada

```
repo_IS_BD2_equipo_CELL/
├─ apps/
│  ├─ backend/                                    API y persistencia
│  └─ frontend/
│     └─ gestion-mantenimiento-planes-industrial-web/
│        ├─ app/
│        │  ├─ auth/          sesión y protección por rol
│        │  ├─ components/    UI compartida y diálogos
│        │  ├─ data/          repositorio, adaptadores y contexto
│        │  ├─ pages/         pantallas
│        │  ├─ routes/        entradas de React Router
│        │  ├─ styles/        estilos propios
│        │  ├─ types/         modelo de dominio
│        │  └─ utils/         reglas puras y permisos
│        ├─ docs/             arquitectura, contrato de API y este flujo
│        ├─ public/
│        └─ package.json
├─ materiales_IS/
├─ .github/
│  └─ pull_request_template.md
└─ README.md
```

Cada issue debe indicar la carpeta o archivo donde se aplica el cambio. Si se
crea una carpeta nueva, se documenta en el PR y, cuando corresponda, en
`docs/arquitectura-front.md`.

## 2. Ramas

La rama estable del equipo es `frontend` (el trabajo de front se integra ahí).
`master` queda como rama principal del repositorio.

| Tipo | Patrón | Ejemplo |
| --- | --- | --- |
| Funcionalidad | `front-1/<issue>-<slug>` | `front-1/10-auth-roles` |
| Corrección | `front-1/fix-<slug>` | `front-1/fix-plan-conflict` |
| Documentación | `front-1/docs-<slug>` | `front-1/docs-api-contract` |
| Pruebas | `front-1/test-<slug>` | `front-1/test-duplicates` |

Reglas:

- Una rama por issue o por cambio coherente; no mezclar temas no relacionados.
- Partir de la rama estable actualizada (`git pull origin frontend`).
- No hacer `push --force` sobre ramas compartidas.
- Borrar la rama remota al integrar el PR.

## 3. Commits

Formato: `tipo(alcance): descripción breve` en imperativo.

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`.

Ejemplos:

```text
feat(front): agregar autenticación y guardas por rol (refs #10)
feat(front): generar planes con parámetros configurables (refs #22 #24)
fix(front): impedir doble asignación de operario (refs #30)
docs(front): documentar patrones y contrato de la API (refs #69)
test(front): cubrir duplicados y matriz de permisos (refs #20)
```

- Un commit debe compilar y mantener las pruebas en verde.
- Referenciar el issue con `refs #<número>`; usar `closes #<número>` solo cuando
  el PR completo resuelva el issue.
- Evitar commits gigantes con cambios no relacionados.

## 4. Pull requests

1. Actualizar la rama estable y crear la rama de trabajo.
2. Implementar código documentado (JSDoc/docstrings en funciones y módulos).
3. Agregar o actualizar pruebas.
4. Ejecutar en `apps/frontend/gestion-mantenimiento-planes-industrial-web`:

   ```bash
   npm test
   npm run typecheck
   npm run build
   ```

5. Abrir el PR contra `frontend` usando la plantilla del repositorio.
6. Completar la lista de verificación del issue (pruebas, documentación,
   revisión).
7. Solicitar revisión a otro integrante del equipo.
8. Atender comentarios con commits nuevos; no reescribir la historia revisada.

### Revisión

El revisor comprueba:

- [ ] El cambio cumple el criterio de aceptación del issue.
- [ ] No hay acciones permitidas a roles incorrectos.
- [ ] Las reglas de negocio están en `utils`/servicios, no duplicadas en la UI.
- [ ] Hay pruebas para la regla o flujo nuevo.
- [ ] `npm test`, `npm run typecheck` y `npm run build` pasan.
- [ ] El código público tiene documentación y los nombres son claros.
- [ ] No se suben secretos, `.env`, `node_modules` ni artefactos de `build/`.
- [ ] La documentación se actualizó si cambió el contrato o la arquitectura.

El PR se integra con *squash and merge* o *merge commit* según lo acuerde el
equipo; el título del merge debe conservar la referencia al issue.

## 5. Definición de terminado

Un issue se cierra cuando:

1. El criterio de aceptación está implementado y verificable.
2. Las pruebas nuevas o actualizadas pasan en local y en CI.
3. El código está documentado (módulos, funciones y decisiones no obvias).
4. El PR fue revisado y aprobado por al menos otra persona.
5. La documentación afectada fue actualizada.

## 6. Protección de la rama y CI

Recomendado para `frontend` y `master`:

- Exigir PR antes de integrar.
- Exigir al menos una aprobación.
- Exigir que `npm test`, `npm run typecheck` y `npm run build` terminen en verde.
- No permitir pushes directos ni force pushes.

Si el repositorio aún no tiene CI, ejecutar los tres comandos manualmente antes
de pedir revisión y adjuntar el resultado en la descripción del PR.

## 7. Incidencias y trazabilidad

- Un bug reproducible se registra como issue con pasos, resultado esperado,
  resultado actual y captura o log.
- Los issues se etiquetan con `front`/`backend` y el responsable (`front-1`,
  `front-2`, etc.).
- Cada PR enlaza su issue; cada issue cerrado debe poder rastrearse a un commit y
  a una prueba.
