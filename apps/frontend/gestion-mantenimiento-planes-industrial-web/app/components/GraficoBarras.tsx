/**
 * Gráfico de barras agrupadas reutilizable, basado en la librería Recharts.
 */
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Una serie del gráfico: un conjunto de barras del mismo color. */
export interface SerieGrafico {
  /** Nombre del campo del dato que contiene el valor de la serie. */
  clave: string;
  /** Nombre mostrado en la leyenda. */
  nombre: string;
  /** Color de las barras (formato CSS). */
  color: string;
}

/** Propiedades de `GraficoBarras`. */
interface Props {
  /** Descripción del gráfico para lectores de pantalla. */
  descripcion: string;
  /** Datos: una entrada por grupo de barras. */
  datos: readonly Record<string, string | number>[];
  /** Nombre del campo que contiene la etiqueta del eje horizontal. */
  claveEtiqueta: string;
  /** Series a dibujar. */
  series: readonly SerieGrafico[];
  /** Sufijo de los valores, por ejemplo "%". */
  unidad?: string;
  /** Valor máximo fijo del eje vertical (ej. 100 para porcentajes). */
  maximoY?: number;
  /** Alto del gráfico en píxeles. */
  altura?: number;
}

/**
 * Dibuja barras agrupadas con ejes, cuadrícula, leyenda y mensaje flotante.
 *
 * Solo se dibuja en el navegador: el contenedor responsivo de Recharts
 * necesita medir el tamaño real de la pantalla, algo imposible en el servidor.
 */
export function GraficoBarras({
  descripcion,
  datos,
  claveEtiqueta,
  series,
  unidad = "",
  maximoY,
  altura = 320,
}: Props) {
  const [enNavegador, setEnNavegador] = useState(false);
  useEffect(() => setEnNavegador(true), []);

  return (
    <div
      role="img"
      aria-label={descripcion}
      className="chart-box"
      style={{ height: altura }}
    >
      {enNavegador ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...datos]} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey={claveEtiqueta} tick={{ fill: "currentColor", fontSize: 12 }} />
            <YAxis
              domain={maximoY ? [0, maximoY] : [0, "auto"]}
              tick={{ fill: "currentColor", fontSize: 12 }}
              unit={unidad}
              allowDecimals={false}
            />
            <Tooltip formatter={(valor) => `${valor}${unidad}`} />
            <Legend itemSorter={null} />
            {series.map((serie) => (
              <Bar
                key={serie.clave}
                dataKey={serie.clave}
                name={serie.nombre}
                fill={serie.color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm">Cargando gráfico…</p>
      )}
    </div>
  );
}
