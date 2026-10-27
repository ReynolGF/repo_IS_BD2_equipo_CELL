import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  // Estas librerías se cargan bajo demanda (al exportar a PDF); se indican
  // aquí para que el servidor de desarrollo las prepare al arrancar.
  optimizeDeps: {
    include: ["jspdf", "jspdf-autotable"],
  },
});
