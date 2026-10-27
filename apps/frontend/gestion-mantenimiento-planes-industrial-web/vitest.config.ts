import { defineConfig } from "vitest/config";

/**
 * Configuración de las pruebas unitarias.
 *
 * Es un archivo aparte de `vite.config.ts` porque el plugin de React Router no
 * se necesita (ni conviene) al ejecutar pruebas.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./app/test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
