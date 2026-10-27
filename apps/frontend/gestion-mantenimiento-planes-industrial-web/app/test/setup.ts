/**
 * Preparación común de todas las pruebas.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/** Quita de la pantalla simulada lo que dibujó cada prueba. */
afterEach(() => {
  cleanup();
});

/**
 * jsdom no incluye `ResizeObserver`, que usa el gráfico de Recharts para
 * medir su contenedor. Se sustituye por una versión que no hace nada.
 */
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverFalso;
