import type { Colaborador } from '../types/rrhh';

/**
 * Permisos que viven en el padrón, no en el código.
 *
 * La regla del proyecto es que los permisos se administran como dato: se
 * guardan en `colaboradores` y se editan desde la pantalla de permisos, para
 * que un cambio de personal no obligue a tocar código ni a recompilar.
 *
 * Esta función está aquí, y no repetida en cada módulo, porque las gráficas se
 * muestran en tres pestañas distintas: con la regla escrita tres veces, tarde o
 * temprano una se quedaría atrás y alguien vería en una pestaña lo que no puede
 * ver en otra.
 */
export const puedeVerGraficas = (
  papel: string | undefined,
  nomina: string | undefined,
  colaboradores: Colaborador[]
): boolean => {
  // Un administrador las ve siempre, sin necesidad de aparecer marcado.
  if (papel === 'ADMIN') return true;
  if (!nomina) return false;
  const yo = colaboradores.find(c => String(c.noNomina).trim() === String(nomina).trim());
  // Ante la duda, no: nunca se concede privilegio por omisión.
  return !!yo?.verGraficas;
};
