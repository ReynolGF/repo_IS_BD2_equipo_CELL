import type { ReactNode } from "react";
import { useMaintenance } from "../../data/MaintenanceContext";

/**
 * Envoltorio común para estados de carga/error de las pantallas que dependen
 * del repositorio. Evita repetir la misma lógica en cada página.
 */
export function PageState({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useMaintenance();

  if (loading) {
    return (
      <div className="panel page-placeholder">
        <span className="loading-mark">M</span>
        <p>Cargando información de mantenimiento…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="panel page-placeholder error-placeholder">
        <h2>No se pudieron cargar los datos</h2>
        <p>{error}</p>
        <button className="button button-primary" onClick={() => void reload()}>
          Reintentar
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
