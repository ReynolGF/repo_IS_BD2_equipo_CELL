import { Metric } from "../../presentation/components/Metric";
import type { Task } from "../models/task";

interface MaintenanceMetricsProps {
  visibleTasks: Task[];
}

export const MaintenanceMetrics = ({
  visibleTasks,
}: MaintenanceMetricsProps) => {
  return (
    <section className="metric-grid metric-grid-compact mb-4 grid grid-cols-4 gap-[14px] max-[1240px]:grid-cols-2 max-[720px]:gap-2.5 max-[520px]:grid-cols-1">
      <Metric
        label="Tareas del banco"
        value={String(visibleTasks.length).padStart(2, "0")}
        hint={`${visibleTasks.filter((task) => task.severity === "Alta").length} de criticidad alta`}
        color="mint"
      />
      <Metric
        label="Preventivas"
        value={String(
          visibleTasks.filter((task) => task.type === "Preventivo").length,
        ).padStart(2, "0")}
        hint="Rutinas programadas"
        color="blue"
      />
      <Metric
        label="Correctivas"
        value={String(
          visibleTasks.filter((task) => task.type === "Correctivo").length,
        ).padStart(2, "0")}
        hint="Intervenciones por falla"
        color="yellow"
      />
    </section>
  );
};
