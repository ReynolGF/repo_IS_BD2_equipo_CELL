import type { Role, SessionUser } from "../types/maintenance";

const SESSION_KEY = "mantenia.session";
const PASSWORD = "demo1234";

type DemoAccount = SessionUser & { password: string };

/**
 * Cuentas de demostración. En producción la autenticación se delega al
 * backend; aquí se simula la respuesta para poder probar la protección por rol.
 */
export const demoAccounts: DemoAccount[] = [
  {
    id: "USR-01",
    name: "Elena Vargas",
    email: "elena@mantenia.demo",
    password: PASSWORD,
    role: "Administrador",
    lines: [],
  },
  {
    id: "USR-02",
    name: "Roberto Salas",
    email: "roberto@mantenia.demo",
    password: PASSWORD,
    role: "Jefe de planta",
    lines: [],
  },
  {
    id: "USR-03",
    name: "Laura Méndez",
    email: "laura@mantenia.demo",
    password: PASSWORD,
    role: "Técnico",
    lines: ["Envasado A", "Llenado 02"],
    technicianId: "TEC-01",
  },
  {
    id: "USR-04",
    name: "Ana Gómez",
    email: "ana@mantenia.demo",
    password: PASSWORD,
    role: "Operario",
    lines: ["Envasado A"],
    operatorId: "OP-01",
  },
];

export const demoPassword = PASSWORD;

/** Simula `POST /auth/login`. */
export async function login(email: string, password: string): Promise<SessionUser> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const account = demoAccounts.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account || account.password !== password) {
    throw new Error("Correo o contraseña incorrectos. Usa una cuenta de demostración.");
  }
  const { password: _password, ...user } = account;
  return user;
}

/** Recupera la sesión guardada en el navegador. */
export function restoreSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as SessionUser;
    const roles: Role[] = ["Administrador", "Técnico", "Operario", "Jefe de planta"];
    return roles.includes(user.role) ? user : null;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
