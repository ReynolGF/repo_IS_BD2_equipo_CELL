import test from "node:test";
import assert from "node:assert/strict";
import {
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
  canAccessPath,
  hasPermission,
} from "./permissions.mjs";

const ROLES = ["Administrador", "Jefe de planta", "Técnico", "Operario"];

test("cada rol tiene una matriz de permisos declarada", () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...ROLES].sort());
  for (const role of ROLES) {
    assert.ok(ROLE_PERMISSIONS[role].length > 0, `${role} debe tener permisos`);
    assert.equal(new Set(ROLE_PERMISSIONS[role]).size, ROLE_PERMISSIONS[role].length);
  }
});

test("el administrador gestiona catálogos, tareas y planes", () => {
  for (const permission of [
    "plans:create",
    "plans:review",
    "tasks:create",
    "tasks:edit",
    "tasks:review",
    "catalogs:manage",
    "reports:view",
  ]) {
    assert.equal(hasPermission("Administrador", permission), true, permission);
  }
});

test("el jefe de planta valida planes pero no administra catálogos ni crea tareas", () => {
  assert.equal(hasPermission("Jefe de planta", "plans:review"), true);
  assert.equal(hasPermission("Jefe de planta", "plans:create"), false);
  assert.equal(hasPermission("Jefe de planta", "catalogs:manage"), false);
  assert.equal(hasPermission("Jefe de planta", "tasks:create"), false);
  assert.equal(hasPermission("Jefe de planta", "tasks:review"), false);
});

test("el técnico crea tareas y planes de sus líneas, sin revisar planes ni gestionar catálogos", () => {
  assert.equal(hasPermission("Técnico", "plans:create"), true);
  assert.equal(hasPermission("Técnico", "tasks:create"), true);
  assert.equal(hasPermission("Técnico", "plans:review"), false);
  assert.equal(hasPermission("Técnico", "tasks:review"), false);
  assert.equal(hasPermission("Técnico", "catalogs:manage"), false);
});

test("el operario solo accede a resumen, ejecución y reportes", () => {
  assert.deepEqual(ROLE_PERMISSIONS.Operario, ["dashboard:view", "execution:view", "reports:view"]);
  assert.equal(hasPermission("Operario", "tasks:view"), false);
  assert.equal(hasPermission("Operario", "sensors:view"), false);
  assert.equal(hasPermission("Operario", "plans:review"), false);
});

test("hasPermission rechaza roles o permisos desconocidos", () => {
  assert.equal(hasPermission("Invitado", "dashboard:view"), false);
  assert.equal(hasPermission("Administrador", "unknown:permission"), false);
});

test("las rutas conocidas se mapean a un permiso", () => {
  assert.equal(ROUTE_PERMISSIONS["/"], "dashboard:view");
  assert.equal(ROUTE_PERMISSIONS["/planes"], "plans:view");
  assert.equal(ROUTE_PERMISSIONS["/reportes"], "reports:view");
  assert.equal(canAccessPath("Operario", "/"), true);
  assert.equal(canAccessPath("Operario", "/ejecucion"), true);
  assert.equal(canAccessPath("Operario", "/reportes"), true);
  assert.equal(canAccessPath("Operario", "/planes"), false);
  assert.equal(canAccessPath("Operario", "/tecnicos"), false);
});

test("canAccessPath admite barras finales y subrutas", () => {
  assert.equal(canAccessPath("Administrador", "/planes/"), true);
  assert.equal(canAccessPath("Administrador", "/planes/PM-2026-018"), true);
  assert.equal(canAccessPath("Técnico", "/tareas/"), true);
  assert.equal(canAccessPath("Técnico", "/lineas"), true);
  assert.equal(canAccessPath("Operario", "/planes/PM-1"), false);
  assert.equal(canAccessPath("Administrador", "/ruta-inexistente"), false);
});
