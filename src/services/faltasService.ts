import {
  collection, doc, onSnapshot, query, where, getDocs, updateDoc, deleteField, serverTimestamp
} from 'firebase/firestore';
import { suiteDb as db } from './suite';

const COLLECTION_NAME = 'faltas';

/**
 * Faltas reportadas desde EPP (SPEC-047).
 *
 * Sustituye a deducirlas contra las revisiones de EPP. El cambio no es solo de
 * costo: la falta pasa de inferirse a estar escrita, así que deja de haber
 * faltas falsas los días en que no se hizo la revisión.
 *
 * Un documento por día, con las faltas de todas las áreas adentro, bajo la
 * nómina de quien faltó. Leer un mes son treinta documentos; deducirlo eran
 * casi dos mil.
 *
 * Todo se devuelve como claves `nómina|fecha`, que es como las buscan las
 * pantallas.
 */
const clavesDeDocumento = (data: any): string[] => {
  const fecha = data?.fecha;
  if (!fecha) return [];
  return Object.keys(data?.reportes || {}).map(nomina => `${nomina}|${fecha}`);
};

/* Lo ya leído por rango, unos minutos. Las faltas de días pasados no cambian;
   las de hoy se refrescan al vencer el plazo. */
const _cache = new Map<string, { claves: Set<string>; expira: number }>();
const VIGENCIA_MS = 3 * 60 * 1000;

/** Se llama al borrar una falta: lo recordado deja de valer. */
export const olvidarFaltasEnCache = () => _cache.clear();

export const obtenerFaltasRango = async (
  fechaDesde: string,
  fechaHasta: string
): Promise<Set<string>> => {
  const claves = new Set<string>();
  if (!fechaDesde || !fechaHasta) return claves;

  const llave = fechaDesde + '|' + fechaHasta;
  const guardado = _cache.get(llave);
  if (guardado && guardado.expira > Date.now()) return new Set(guardado.claves);

  const snap = await getDocs(query(
    collection(db, COLLECTION_NAME),
    where('fecha', '>=', fechaDesde),
    where('fecha', '<=', fechaHasta)
  ));
  snap.docs.forEach(d => clavesDeDocumento(d.data()).forEach(k => claves.add(k)));

  _cache.set(llave, { claves: new Set(claves), expira: Date.now() + VIGENCIA_MS });
  return claves;
};

/** Una falta reportada, con todo lo que EPP guardó de ella. */
export interface FaltaReportada {
  fecha: string;
  nomina: string;
  nombre: string;
  area: string;
  turno: string;
  porNombre: string;
}

/**
 * Las faltas del rango con su detalle (SPEC-047).
 *
 * Hace falta para el reporte: una falta de alguien **sin turno asignado** ese
 * día no se puede describir a partir del rol, porque no hay rol. Sin su
 * detalle quedaría guardada y nadie la vería nunca.
 */
export const obtenerFaltasDetalleRango = async (
  fechaDesde: string,
  fechaHasta: string
): Promise<FaltaReportada[]> => {
  if (!fechaDesde || !fechaHasta) return [];
  const snap = await getDocs(query(
    collection(db, COLLECTION_NAME),
    where('fecha', '>=', fechaDesde),
    where('fecha', '<=', fechaHasta)
  ));
  const salida: FaltaReportada[] = [];
  snap.docs.forEach(d => {
    const data: any = d.data();
    Object.entries(data?.reportes || {}).forEach(([nomina, r]: [string, any]) => {
      salida.push({
        fecha: data.fecha,
        nomina,
        nombre: r?.nombre || '',
        area: String(r?.area || '').trim().toUpperCase(),
        turno: r?.turno || '',
        porNombre: r?.porNombre || ''
      });
    });
  });
  return salida;
};

/** En vivo, para la cuadrícula del rol abierto. */
export const subscribeFaltasRango = (
  fechaDesde: string,
  fechaHasta: string,
  callback: (claves: Set<string>) => void
) => {
  if (!fechaDesde || !fechaHasta) { callback(new Set()); return () => {}; }
  return onSnapshot(
    query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', fechaDesde),
      where('fecha', '<=', fechaHasta)
    ),
    snap => {
      const claves = new Set<string>();
      snap.docs.forEach(d => clavesDeDocumento(d.data()).forEach(k => claves.add(k)));
      callback(claves);
    },
    err => console.error('No se pudieron leer las faltas:', err)
  );
};

/**
 * Borra una falta reportada por error (SPEC-047).
 *
 * Sustituye al «Sí vino» (SPEC-032). Aquello perdonaba una falta deducida que
 * nunca existió; esto corrige un dato que alguien escribió, que es más honesto:
 * se quita el renglón en lugar de añadir otro que lo contradiga.
 */
export const borrarFaltaReportada = async (
  fecha: string,
  noNomina: string,
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, fecha), {
    [`reportes.${noNomina}`]: deleteField(),
    borradoPor: autor,
    actualizadoEn: serverTimestamp()
  });
  olvidarFaltasEnCache();
};
