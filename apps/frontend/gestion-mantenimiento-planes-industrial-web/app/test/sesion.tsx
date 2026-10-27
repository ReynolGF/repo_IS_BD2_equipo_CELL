/**
 * Ayudas de prueba para simular la sesión de un usuario con un rol.
 *
 * Las pantallas leen el alcance del usuario del contexto de sesión; en las
 * pruebas se envuelven con `ConSesion` para elegir quién está conectado. Las
 * cuentas son las de demostración de `app/auth/authService.ts`.
 */
import type { ReactNode } from "react";
import { AuthContext } from "../auth/AuthContext";
import { demoAccounts } from "../auth/authService";
import type { Role, SessionUser } from "../types/maintenance";

/**
 * Devuelve el usuario de demostración de un rol (sin su contraseña).
 *
 * @param rol Rol buscado.
 */
export function usuarioDe(rol: Role): SessionUser {
  const cuenta = demoAccounts.find((c) => c.role === rol);
  if (!cuenta) throw new Error(`No hay cuenta de demostración para ${rol}`);
  const { password: _password, ...usuario } = cuenta;
  return usuario;
}

/** Propiedades de `ConSesion`. */
interface Props {
  /** Usuario conectado; por defecto, el administrador. */
  usuario?: SessionUser;
  /** Contenido que se dibuja con esa sesión. */
  children: ReactNode;
}

/** Proveedor de sesión falso para las pruebas. */
export function ConSesion({ usuario = usuarioDe("Administrador"), children }: Props) {
  const valor = {
    user: usuario,
    ready: true,
    signIn: async () => usuario,
    signOut: () => undefined,
  };
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
