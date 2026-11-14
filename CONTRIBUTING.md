# Guía de contribución

## Ramas

- `main`: solo recibe merges desde `develop` en cada entrega. Protegida.
- `develop`: rama de integración. Protegida.
- Ramas de trabajo, siempre creadas desde `develop`, con el área en el nombre:
  - `feature/backend-RF9-generacion-planes`
  - `fix/backend-unicidad-tareas`
  - `docs/backend-decisiones`

## Commits (Conventional Commits)

Formato: `tipo(area): descripción en imperativo`

```
feat(backend): añade endpoint de líneas
fix(backend): corrige unicidad de tareas
test(backend): cubre la máquina de estados del plan
docs: actualiza el README
chore(ci): fija la versión de Python
```

Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.

## Pull requests

1. El PR va a `develop`, con al menos 1 revisión y el CI (`test`) en verde.
2. Quien revisa no es quien escribió el código; roten las revisiones.
3. Los cambios en archivos de la raíz (`.github/`, `docker-compose.yml`, `.gitignore`) se avisan antes al equipo.
