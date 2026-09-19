import type { Colaborador, CursoCapacitacion } from '../types/rrhh';
import { hoyISO } from './fechas';

/**
 * Si un curso le toca a una persona.
 *
 * Vive aquí, y no dentro de una pestaña, porque la usan **Cursos** para armar
 * la matriz de pendientes y **Capacitación** para contar participantes en el
 * calendario. Escrita dos veces, una de las dos acabaría contando distinto y
 * los dos números nunca cuadrarían.
 */
export const cursoAplicaA = (colab: Colaborador, curso: CursoCapacitacion): boolean => {
  const depto = (colab.departamento || '').toUpperCase().trim();
  const puesto = (colab.puesto || '').toUpperCase().trim();

  const deptosObj = (curso.departamentosObjetivo || []).map(d => d.toUpperCase().trim());
  const puestosObj = (curso.puestosObjetivo || []).map(p => p.toUpperCase().trim());

  const deptoCoincide = deptosObj.includes('TODOS') || deptosObj.includes('GENERAL') || deptosObj.includes(depto);
  // Sin puestos objetivo, el curso es de todo el departamento.
  const puestoCoincide = puestosObj.length === 0 || puestosObj.includes(puesto);

  return deptoCoincide && puestoCoincide;
};

/** Cómo va un curso respecto de su fecha compromiso (SPEC-033). */
export type EstadoAvance = 'VIGENTE' | 'COMPLETO' | 'PARCIAL' | 'ATRASADO' | 'SIN_PARTICIPANTES';

/**
 * Califica el avance de un curso.
 *
 * El corte es la **fecha compromiso**, que es `fechaFin`: antes de ella no se
 * juzga nada, porque todavía hay tiempo de tomarlo. Un curso que aún no vence
 * sale como `VIGENTE` aunque no lo haya tomado nadie.
 *
 * Los cortes son 100 %, 50 % y menos de 50 %. Se pidieron «menos del 50»,
 * «arriba del 50.1» y «100», que dejaban fuera el 50 exacto; aquí el 50 cuenta
 * como parcial, porque la mitad del grupo capacitada no es lo mismo que nadie.
 */
export const avanceDelCurso = (
  curso: CursoCapacitacion,
  totalParticipantes: number,
  cuantosTomaron: number
): { estado: EstadoAvance; porcentaje: number } => {
  const porcentaje = totalParticipantes > 0
    ? Math.round((cuantosTomaron / totalParticipantes) * 1000) / 10
    : 0;

  // Comparación de texto entre fechas `AAAA-MM-DD` (regla R3).
  const vencio = !!curso.fechaFin && curso.fechaFin < hoyISO();
  if (!vencio) return { estado: 'VIGENTE', porcentaje };
  if (totalParticipantes === 0) return { estado: 'SIN_PARTICIPANTES', porcentaje: 0 };
  if (cuantosTomaron >= totalParticipantes) return { estado: 'COMPLETO', porcentaje: 100 };
  if (porcentaje >= 50) return { estado: 'PARCIAL', porcentaje };
  return { estado: 'ATRASADO', porcentaje };
};

/** Colores de cada estado. Pastel, para que la tabla siga siendo legible. */
export const COLOR_AVANCE: Record<EstadoAvance, { fondo: string; texto: string; borde: string; etiqueta: string }> = {
  VIGENTE:           { fondo: '#EEF2F7', texto: '#003580', borde: '#CBD7E8', etiqueta: 'En tiempo' },
  COMPLETO:          { fondo: '#DCFCE7', texto: '#166534', borde: '#A7E8BE', etiqueta: 'Completo' },
  PARCIAL:           { fondo: '#FEF3C7', texto: '#92400E', borde: '#F5D98B', etiqueta: 'Incompleto' },
  ATRASADO:          { fondo: '#FEE2E2', texto: '#B91C1C', borde: '#F5B5B5', etiqueta: 'Atrasado' },
  SIN_PARTICIPANTES: { fondo: '#F1F5F9', texto: '#64748B', borde: '#DDE3EA', etiqueta: 'Sin participantes' }
};
