import { Link } from "react-router";

export function meta() {
  return [{ title: "Página no encontrada · Mantenia" }];
}

export default function NotFoundRoute() {
  return (
    <main className="permission-page">
      <span className="permission-code">404</span>
      <h1>Página no encontrada</h1>
      <p>La ruta que buscas no existe o fue movida dentro del sistema.</p>
      <Link className="button button-primary" to="/">
        Volver al resumen
      </Link>
    </main>
  );
}
