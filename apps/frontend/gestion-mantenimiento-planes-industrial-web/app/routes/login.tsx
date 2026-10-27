import { LoginPage } from "../pages/LoginPage";

export function meta() {
  return [
    { title: "Iniciar sesión · Mantenia" },
    { name: "description", content: "Acceso al sistema de gestión de mantenimiento industrial." },
  ];
}

export default function LoginRoute() {
  return <LoginPage />;
}
