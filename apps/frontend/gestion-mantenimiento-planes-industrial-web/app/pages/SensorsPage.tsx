import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Metric, PanelTitle } from "../components/maintenance/Shared";
import type { SensorReading } from "../types/maintenance";

/** Lecturas agregadas de sensores por equipo y línea. */
export function SensorsPage() {
  const { user } = useAuth();
  const { data, query } = useMaintenance();
  const [line, setLine] = useState("Todas las líneas");
  const [status, setStatus] = useState("Todos");
  const [sort, setSort] = useState({ key: "equipment", asc: true });

  const scopedSensors =
    data && user
      ? data.sensors.filter(
          (sensor) => user.role !== "Técnico" || user.lines.includes(sensor.line),
        )
      : [];
  const sensors = scopedSensors.filter(
    (sensor) =>
      (line === "Todas las líneas" || sensor.line === line) &&
      (status === "Todos" || sensor.status === status) &&
      `${sensor.equipment} ${sensor.line} ${sensor.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const lines = data
    ? user?.role === "Técnico"
      ? data.lines.filter((item) => user.lines.includes(item.name))
      : data.lines
    : [];

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Equipos monitoreados"
              value={String(scopedSensors.length).padStart(2, "0")}
              hint="Lecturas de las últimas 24 h"
              color="mint"
            />
            <Metric
              label="Estables"
              value={String(scopedSensors.filter((sensor) => sensor.status === "Estable").length).padStart(2, "0")}
              hint="Dentro de los umbrales"
              color="blue"
            />
            <Metric
              label="Para revisar"
              value={String(scopedSensors.filter((sensor) => sensor.status === "Revisar").length).padStart(2, "0")}
              hint="Vibración o presión elevada"
              color="yellow"
            />
            <Metric
              label="Alertas altas"
              value={String(scopedSensors.filter((sensor) => sensor.status === "Alerta alta").length).padStart(2, "0")}
              hint="Requieren intervención"
              color="coral"
            />
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <PanelTitle
                title="Lecturas agregadas por equipo"
                subtitle="Temperatura, vibración y presión consolidadas para análisis."
              />
            </div>
            <div className="filters">
              <label className="filter-field">
                Línea
                <select value={line} onChange={(event) => setLine(event.target.value)}>
                  <option>Todas las líneas</option>
                  {lines.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                Estado
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option>Todos</option>
                  <option>Estable</option>
                  <option>Revisar</option>
                  <option>Alerta alta</option>
                </select>
              </label>
              <span className="filter-count">{sensors.length} equipos</span>
            </div>
            <DataTable
              columns={[
                { key: "equipment", label: "EQUIPO" },
                { key: "line", label: "LÍNEA" },
                { key: "period", label: "PERIODO" },
                { key: "temperature", label: "TEMPERATURA" },
                { key: "vibration", label: "VIBRACIÓN" },
                { key: "pressure", label: "PRESIÓN" },
                { key: "status", label: "ESTADO" },
              ]}
              rows={sensors}
              sort={sort}
              setSort={setSort}
              empty="No hay lecturas para los filtros seleccionados."
              render={(sensor) => (
                <tr key={`${sensor.equipment}-${sensor.line}`}>
                  <td>
                    <strong>{sensor.equipment}</strong>
                  </td>
                  <td>{sensor.line}</td>
                  <td>{sensor.period}</td>
                  <td>{sensor.temperature} °C</td>
                  <td>{sensor.vibration} mm/s</td>
                  <td>{sensor.pressure} bar</td>
                  <td>
                    <SensorStatus value={sensor.status} />
                  </td>
                </tr>
              )}
            />
            <p className="sensor-note">
              Umbrales de referencia: temperatura &gt; 75 °C, vibración &gt; 6 mm/s o presión fuera
              de 5–7 bar generan una alerta de revisión.
            </p>
          </section>
        </>
      )}
    </PageState>
  );
}

function SensorStatus({ value }: { value: SensorReading["status"] }) {
  const tone =
    value === "Estable" ? "status-approved" : value === "Revisar" ? "status-review" : "status-rejected";
  return <span className={`status-pill ${tone}`}>{value}</span>;
}
