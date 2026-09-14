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
    /**
     * Solo ADMIN captura. Antes CAPTURA también podía alimentar incidencias,
     * cursos, capacitación y vacantes; a partir de la v2.3 la captura queda
     * reservada a administradores y CAPTURA se comporta igual que CONSULTA
     * dentro de esta aplicación.
     */
    puedeCapturar: papel === 'ADMIN',
    /** Todos pueden exportar: es descarga bajo demanda y no modifica nada. */
    puedeExportar: true
  };
}
