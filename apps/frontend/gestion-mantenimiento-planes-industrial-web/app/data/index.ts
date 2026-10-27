import { ApiMaintenanceService } from "./ApiMaintenanceService";
import { DemoMaintenanceService } from "./DemoMaintenanceService";
import type { MaintenanceRepository } from "./MaintenanceRepository";

export type DataSource = "demo" | "api";

const SOURCE_KEY = "mantenia.data-source";

/** URL base configurada en `.env` (por ejemplo `http://localhost:8000/api`). */
export const apiBaseUrl = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const apiAvailable = Boolean(apiBaseUrl);

/** Lee la fuente seleccionada por el usuario. En SSR siempre arranca en demo. */
export function getDataSource(): DataSource {
  if (typeof window === "undefined") return "demo";
  const stored = window.localStorage.getItem(SOURCE_KEY);
  return stored === "api" && apiAvailable ? "api" : "demo";
}

/** Guarda la fuente y recarga para reconstruir el cliente con la estrategia. */
export function setDataSource(source: DataSource) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOURCE_KEY, source);
  window.location.reload();
}

/**
 * Fábrica (patrón Factory + Strategy): devuelve la implementación del puerto
 * según la configuración. La UI solo conoce `MaintenanceRepository`.
 */
export function createMaintenanceService(
  source: DataSource = getDataSource(),
): MaintenanceRepository {
  if (source === "api" && apiAvailable) {
    return new ApiMaintenanceService(apiBaseUrl);
  }
  return new DemoMaintenanceService();
}

/** Instancia única usada por el proveedor de datos de la aplicación. */
export const maintenance = createMaintenanceService();
