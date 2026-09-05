/**
 * Catálogo cerrado de departamentos, idéntico al de la suite.
 *
 * Se comparan como texto exacto entre aplicaciones: un acento o una mayúscula
 * distinta deja a un trabajador sin equipo de protección asignado en EPP, y
 * falla en silencio. Por eso se elige de una lista y no se escribe libre.
 */
export const DEPARTAMENTOS = [
  'ACONDICIONADO',
  'ADMINISTRACIÓN',
  'CALIDAD',
  'DIGITAL',
  'FLEXOGRAFÍA',
  'LOGÍSTICA',
  'MANTENIMIENTO',
  'OPERACIONES',
  'PREPRENSA',
  'RECURSOS HUMANOS',
  'ROTOGRABADO',
  'TINTAS',
  'VENTAS'
] as const;

export type Departamento = (typeof DEPARTAMENTOS)[number];

export function esDepartamentoValido(valor: string): valor is Departamento {
  return (DEPARTAMENTOS as readonly string[]).includes(valor);
}

/**
 * Quita acentos, pasa a mayúsculas y colapsa espacios.
 * Sirve para comparar departamentos y otros textos sueltos.
 */
export function normalizarTexto(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula `nombreNormalizado` tal como está en la colección de la suite:
 * las palabras del nombre **ordenadas alfabéticamente**.
 *
 *   MORENO GARCIA VICTOR        ->  GARCIA MORENO VICTOR
 *   SOTO MENESES OSCAR          ->  MENESES OSCAR SOTO
 *   GARCIA ELVIRA FRANCISCO JAVIER -> ELVIRA FRANCISCO GARCIA JAVIER
 *
 * No es un capricho: ordenar las palabras hace que la búsqueda no dependa del
 * orden en que se escriba. «Víctor Moreno» y «Moreno Víctor» producen la misma
 * cadena, así que las dos encuentran a la misma persona.
 *
 * Si esto se calculara de otra forma, los registros nuevos quedarían en un
 * formato y el resto de la colección en otro, y las búsquedas de las demás
 * aplicaciones empezarían a fallar de manera intermitente.
 */
export function normalizarNombre(nombre: string): string {
  return normalizarTexto(nombre)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Intenta reconocer un departamento escrito con acentos faltantes o sobrantes,
 * para poder avisar con precisión en la importación de Excel.
 * Devuelve el valor oficial del catálogo, o null si no corresponde a ninguno.
 */
export function reconocerDepartamento(valor: string): Departamento | null {
  const buscado = normalizarTexto(valor);
  const hallado = DEPARTAMENTOS.find(d => normalizarTexto(d) === buscado);
  return hallado ?? null;
}

/** La antigüedad se calcula al vuelo. Guardarla la deja vieja cada mes. */
export function calcularAntiguedad(fechaIngreso: string): { anios: number; meses: number } {
  if (!fechaIngreso) return { anios: 0, meses: 0 };
  const ingreso = new Date(fechaIngreso + 'T00:00:00');
  if (isNaN(ingreso.getTime())) return { anios: 0, meses: 0 };

  const hoy = new Date();
  let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
  if (hoy.getDate() < ingreso.getDate()) meses--;
  if (meses < 0) meses = 0;

  return { anios: Math.floor(meses / 12), meses: meses % 12 };
}
