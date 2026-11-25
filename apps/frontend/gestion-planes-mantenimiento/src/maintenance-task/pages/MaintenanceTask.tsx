import {Metric} from "../components/Metric.tsx";
import type {Task} from "../models/task.ts";
import {DataTable} from "../components/DataTable.tsx";
import {SeverityTag} from "../components/SeverityTag.tsx";

export const MaintenanceTask = () => {
    const visibleTasks : Task[] =
        [
            {id : "1",name:"a", system: "1", line: "1",type: "Correctivo", severity : "Alta",author: "1",duration: 10, timesExecuted: 2},
            {id:"2",name: "b", system: "2", line: "2",type: "Predictivo", severity: "Baja",author: "2", duration: 20, timesExecuted: 1,},
            {id: "3", name: "c", system: "3", line: "3", type: "Preventivo", severity: "Media", author: "3", duration: 30, timesExecuted: 3}
        ]
    return (
        <>
            <section className="metric-grid metric-grid-compact mb-4 grid grid-cols-4 gap-[14px] max-[1240px]:grid-cols-2 max-[720px]:gap-2.5 max-[520px]:grid-cols-1">
                <Metric
                    label="Tareas del banco"
                    value={String(visibleTasks.length).padStart(2, "0")}
                    hint={`${visibleTasks.filter((task) => task.severity === "Alta").length} de criticidad alta`}
                    color="mint"
                />
                <Metric
                    label="Preventivas"
                    value={String(visibleTasks.filter((task) => task.type === "Preventivo").length).padStart(2, "0")}
                    hint="Rutinas programadas"
                    color="blue"
                />
                <Metric
                    label="Correctivas"
                    value={String(visibleTasks.filter((task) => task.type === "Correctivo").length).padStart(2, "0")}
                    hint="Intervenciones por falla"
                    color="yellow"
                />
            </section>
            <DataTable
                columns={[
                    { key: "id", label: "ID" },
                    { key: "name", label: "TAREA" },
                    { key: "line", label: "LÍNEA" },
                    { key: "system", label: "SISTEMA / EQUIPO" },
                    { key: "type", label: "TIPO" },
                    { key: "severity", label: "CRITICIDAD" },
                    { key: "author", label: "TÉCNICO CREADOR" },
                    { key: "timesExecuted", label: "EJECUCIONES" },
                    { key: "actions", label: "ACCIONES" },
                ]}
                empty="No hay tareas que coincidan con la búsqueda."
                render={(task:Task) => (
                    <tr key={task.id}>
                        <td className="plan-id">{task.id}</td>
                        <td>
                            <strong>{task.name}</strong>
                            <small className="cell-hint">{task.duration} min estimados</small>

                        </td>
                        <td>{task.line}</td>
                        <td>{task.system}</td>
                        <td>{task.type}</td>
                        <td>
                            <SeverityTag value={task.severity} />
                        </td>
                        <td>{task.author}</td>
                        <td>{task.timesExecuted}</td>
                        <td>
                             (
                                <div className="row-actions">
                                    <button>Editar</button>
                                    <button
                                        className="danger-link"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            ) : (
                                <span className="cell-hint">Solo lectura</span>
                            )
                        </td>
                    </tr>
                )}
            />
        </>
    )
}