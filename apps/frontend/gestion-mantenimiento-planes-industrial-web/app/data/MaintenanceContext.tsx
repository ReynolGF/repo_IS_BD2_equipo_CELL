import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { maintenance } from ".";
import type {
  DuplicateRequest,
  DuplicateStatus,
  Intervention,
  MaintenanceData,
  NewPlanInput,
  NewTaskInput,
  Operator,
  Plan,
  ProductionLine,
  Task,
  Technician,
} from "../types/maintenance";

type Toast = { message: string; kind: "success" | "error" };

type MaintenanceContextValue = {
  data: MaintenanceData | null;
  loading: boolean;
  error: string;
  query: string;
  setQuery: (value: string) => void;
  toast: Toast | null;
  notify: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: () => void;
  reload: () => Promise<void>;
  createTask: (input: NewTaskInput) => Promise<Task>;
  updateTask: (task: Task) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  requestDuplicate: (input: {
    draft: NewTaskInput;
    reason: string;
    requestedBy: string;
  }) => Promise<DuplicateRequest>;
  reviewDuplicate: (input: {
    id: string;
    status: Exclude<DuplicateStatus, "Pendiente">;
    reviewer: string;
    notes: string;
  }) => Promise<DuplicateRequest>;
  saveLine: (line: ProductionLine) => Promise<ProductionLine>;
  deleteLine: (id: string) => Promise<void>;
  saveTechnician: (technician: Technician) => Promise<Technician>;
  deleteTechnician: (id: string) => Promise<void>;
  saveOperator: (operator: Operator) => Promise<Operator>;
  deleteOperator: (id: string) => Promise<void>;
  generatePlan: (input: NewPlanInput) => Promise<Plan>;
  savePlan: (plan: Plan) => Promise<Plan>;
  recordIntervention: (input: Omit<Intervention, "id">) => Promise<Intervention>;
  updateIntervention: (intervention: Intervention) => Promise<Intervention>;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

/**
 * Proveedor de estado de la aplicación: carga una vez el repositorio y expone
 * acciones que refrescan los datos y publican avisos. Es el punto único de
 * acceso a datos para todas las pantallas (patrón Provider).
 */
export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismissToast = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const notify = useCallback((message: string, kind: Toast["kind"] = "success") => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await maintenance.load();
      setData(next);
      setError("");
    } catch (cause) {
      const message = messageOf(cause);
      setError(message);
      throw cause;
    }
  }, []);

  useEffect(() => {
    maintenance
      .load()
      .then(setData)
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: string): Promise<T> => {
      try {
        const result = await action();
        const next = await maintenance.load();
        setData(next);
        setError("");
        if (success) notify(success);
        return result;
      } catch (cause) {
        notify(messageOf(cause), "error");
        throw cause;
      }
    },
    [notify],
  );

  const value = useMemo<MaintenanceContextValue>(
    () => ({
      data,
      loading,
      error,
      query,
      setQuery,
      toast,
      notify,
      dismissToast,
      reload,
      createTask: (input) => run(() => maintenance.createTask(input), "Tarea agregada al banco."),
      updateTask: (task) => run(() => maintenance.updateTask(task), "Tarea actualizada."),
      deleteTask: (id) => run(() => maintenance.deleteTask(id), "Tarea eliminada."),
      requestDuplicate: (input) =>
        run(() => maintenance.requestDuplicate(input), "Solicitud de duplicado enviada a revisión."),
      reviewDuplicate: (input) =>
        run(
          () => maintenance.reviewDuplicate(input),
          input.status === "Aprobada" ? "Duplicado aprobado y tarea agregada." : "Duplicado rechazado.",
        ),
      saveLine: (line) =>
        run(() => maintenance.saveLine(line), line.id ? "Línea actualizada." : "Línea creada."),
      deleteLine: (id) => run(() => maintenance.deleteLine(id), "Línea eliminada."),
      saveTechnician: (technician) =>
        run(
          () => maintenance.saveTechnician(technician),
          technician.id ? "Técnico actualizado." : "Técnico registrado.",
        ),
      deleteTechnician: (id) => run(() => maintenance.deleteTechnician(id), "Técnico eliminado."),
      saveOperator: (operator) =>
        run(
          () => maintenance.saveOperator(operator),
          operator.id ? "Operario actualizado." : "Operario registrado.",
        ),
      deleteOperator: (id) => run(() => maintenance.deleteOperator(id), "Operario eliminado."),
      generatePlan: (input) =>
        run(() => maintenance.createPlan(input), "Plan generado y enviado a revisión."),
      savePlan: (plan) => run(() => maintenance.savePlan(plan), "Plan actualizado."),
      recordIntervention: (input) =>
        run(() => maintenance.createIntervention(input), "Intervención guardada en el historial."),
      updateIntervention: (intervention) =>
        run(() => maintenance.updateIntervention(intervention), "Intervención actualizada."),
    }),
    [data, loading, error, query, toast, notify, dismissToast, reload, run],
  );

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) throw new Error("useMaintenance debe usarse dentro de MaintenanceProvider.");
  return context;
}
