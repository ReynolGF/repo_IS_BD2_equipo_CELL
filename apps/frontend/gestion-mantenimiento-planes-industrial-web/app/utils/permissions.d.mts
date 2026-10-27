import type { Role } from "../types/maintenance";

export type Permission =
  | "dashboard:view"
  | "plans:view"
  | "plans:create"
  | "plans:review"
  | "plans:start"
  | "tasks:view"
  | "tasks:create"
  | "tasks:edit"
  | "tasks:review"
  | "catalogs:view"
  | "catalogs:manage"
  | "execution:view"
  | "sensors:view"
  | "reports:view";

export const ROLE_PERMISSIONS: Record<Role, Permission[]>;
export const ROUTE_PERMISSIONS: Record<string, Permission>;
export function hasPermission(role: Role, permission: Permission): boolean;
export function permissionForPath(pathname: string): Permission | undefined;
export function canAccessPath(role: Role, pathname: string): boolean;
