/**
 * Utilidades de fecha para cadenas `AAAA-MM-DD`.
 *
 * Existen por un motivo concreto: `new Date('1985-03-01')` no crea el 1 de
 * marzo local, crea la medianoche **UTC** de ese día. En México (UTC-6) eso
 * cae el 28 de febrero a las 18:00, así que `getMonth()` devuelve febrero y
 * `getDate()` devuelve 28. Cualquiera que haya nacido o entrado el día 1 de un
 * mes se corre al mes anterior, y el error no se ve hasta que alguien reclama
 * que su cumpleaños no salió en la lista.
 */

/** Parte una fecha `AAAA-MM-DD` sin que la zona horaria la mueva de día. */
export const partesFecha = (iso?: string): { anio: number; mes: number; dia: number } | null => {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const anio = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { anio, mes, dia };
};

/** Convierte `AAAA-MM-DD` en un `Date` situado en la zona local, no en UTC. */
export const fechaLocal = (iso?: string): Date | null => {
  const p = partesFecha(iso);
  if (!p) return null;
  const d = new Date(p.anio, p.mes - 1, p.dia);
  return isNaN(d.getTime()) ? null : d;
};

/** Muestra una fecha como `14 de marzo`, sin el año. */
export const diaYMes = (iso?: string): string => {
  const d = fechaLocal(iso);
  if (!d) return '-';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
};

/**
 * Edad que la persona cumple este año.
 *
 * Devuelve `null` si la fecha no trae un año creíble: hay bases donde el año
 * viene como 1900 o como el año en curso porque solo se capturó día y mes, y
 * anunciar que alguien cumple 126 años es peor que no decir nada.
 */
export const edadQueCumple = (iso?: string): number | null => {
  const p = partesFecha(iso);
  if (!p) return null;
  const edad = new Date().getFullYear() - p.anio;
  if (edad < 14 || edad > 90) return null;
  return edad;
};
