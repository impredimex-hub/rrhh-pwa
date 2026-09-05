import { createContext, useContext } from 'react';
import type { Sesion, PapelRRHH } from './suite';

/**
 * La sesión se comparte por contexto para que cada módulo consulte el papel sin
 * tener que recibirlo por props a través de toda la jerarquía.
 */
export const SesionContext = createContext<Sesion | null>(null);

export function useSesion(): Sesion | null {
  return useContext(SesionContext);
}

/**
 * Atajo para las verificaciones de permiso dentro de los módulos.
 * Ante la duda devuelve `false`: nunca se concede privilegio por omisión.
 */
export function usePermisos() {
  const sesion = useSesion();
  const papel: PapelRRHH = sesion?.papel ?? 'CONSULTA';
  return {
    papel,
    /** Solo ADMIN escribe el padrón: sostiene el login de las cinco apps. */
    puedeEditarPadron: papel === 'ADMIN',
    /** ADMIN y CAPTURA alimentan incidencias, cursos, capacitación y vacantes. */
    puedeCapturar: papel === 'ADMIN' || papel === 'CAPTURA',
    /** Todos pueden exportar: es descarga bajo demanda y no modifica nada. */
    puedeExportar: true
  };
}
