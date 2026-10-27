/**
 * Hook que entrega a las pantallas el alcance del usuario de la sesión.
 *
 * Lee el contexto de sesión sin lanzar error si no hay `AuthProvider`: en ese
 * caso devuelve un alcance vacío, que no permite ver nada (es lo más seguro).
 */
import { useContext } from "react";
import { alcanceDeUsuario, type Alcance } from "../utils/alcance";
import { AuthContext } from "./AuthContext";

/** Alcance (rol y líneas) del usuario autenticado. */
export function useAlcance(): Alcance {
  const contexto = useContext(AuthContext);
  return alcanceDeUsuario(contexto?.user ?? null);
}
