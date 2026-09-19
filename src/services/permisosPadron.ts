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

/**
 * Quién puede revertir una falta y darla por asistencia (SPEC-032).
 *
 * **Rompe a propósito el patrón de los demás permisos: ser ADMIN no basta.**
 * Se pidió que lo tuviera una sola persona, y si el papel lo concediera,
 * cualquier administrador podría borrar faltas sin que nadie lo hubiera
 * decidido.
 *
 * Eso no lo vuelve un candado: un ADMIN administra la pantalla de permisos y
 * podría marcarse a sí mismo (regla R6). Lo que sostiene la regla es que cada
 * corrección queda firmada con nombre, fecha y motivo.
 */
export const puedeRevertirFaltas = (
  nomina: string | undefined,
  colaboradores: Colaborador[]
): boolean => {
  if (!nomina) return false;
  const yo = colaboradores.find(c => String(c.noNomina).trim() === String(nomina).trim());
  // Ante la duda, no: nunca se concede privilegio por omisión.
  return !!yo?.revertirFaltas;
};
