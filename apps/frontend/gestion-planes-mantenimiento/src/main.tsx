import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MaintenanceTaskPage } from "./maintenance-task/presentation/pages/MaintenanceTaskPage.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <MaintenanceTaskPage />
    </QueryClientProvider>
  </StrictMode>,
);
