import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { demoAccounts, demoPassword } from "../auth/authService";
import { useAuth } from "../auth/AuthContext";
import { LoadingScreen } from "../auth/PermissionGate";

/** Pantalla de autenticación con accesos rápidos para cada rol. */
export function LoginPage() {
  const { user, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingScreen message="Restaurando sesión…" />;
  if (user) return <Navigate to="/" replace />;

  const destination = (location.state as { from?: string } | null)?.from ?? "/";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  const enterAs = async (accountEmail: string) => {
    setBusy(true);
    setError("");
    try {
      await signIn(accountEmail, demoPassword);
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="login-brand">
          <span className="brand-mark">
            <span />
          </span>
          <span className="brand-name">
            mantenia<span>.</span>
            <small>INDUSTRIAL OS</small>
          </span>
        </div>
        <div className="login-copy">
          <span className="login-kicker">GESTIÓN DE MANTENIMIENTO INDUSTRIAL</span>
          <h1>Planes, tareas y equipos bajo control.</h1>
          <p>
            Genera planes automáticos, valida la programación con la jefatura de planta y
            registra la ejecución de cada operario con trazabilidad completa.
          </p>
          <div className="login-stats">
            <div>
              <strong>03</strong>
              <span>líneas monitoreadas</span>
            </div>
            <div>
              <strong>06</strong>
              <span>planes en seguimiento</span>
            </div>
            <div>
              <strong>04</strong>
              <span>roles protegidos</span>
            </div>
          </div>
        </div>
        <p className="login-legal">Proyecto académico · Ingeniería de Software · 2026</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="modal-kicker">ACCESO AL SISTEMA</span>
          <h2>Inicia sesión</h2>
          <p className="login-subtitle">
            Usa una cuenta de demostración para probar la navegación y los permisos por rol.
          </p>

          <form onSubmit={submit} className="login-form">
            <label>
              Correo corporativo
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@mantenia.demo"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-primary login-submit" disabled={busy}>
              {busy ? "Verificando…" : "Entrar al sistema"}
            </button>
          </form>

          <div className="demo-divider">
            <span>Accesos rápidos de demostración</span>
          </div>
          <div className="demo-accounts">
            {demoAccounts.map((account) => (
              <button
                key={account.id}
                className="demo-account"
                onClick={() => enterAs(account.email)}
                disabled={busy}
                type="button"
              >
                <span className="demo-avatar">
                  {account.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <strong>{account.name}</strong>
                  <small>{account.role}</small>
                </span>
                <span className="demo-arrow">→</span>
              </button>
            ))}
          </div>
          <p className="login-hint">
            Contraseña para todas las cuentas: <code>{demoPassword}</code>
          </p>
        </div>
      </section>
    </div>
  );
}
