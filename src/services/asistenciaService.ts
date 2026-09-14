import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
// La asistencia la escribe EPP, y lo hace en el proyecto compartido de la
// suite: es el único terreno que las dos aplicaciones ya tienen en común. EPP
// guarda sus inspecciones en Realtime Database de su propio proyecto, que
// desde aquí no se ve, y además esos registros traen foto y firma en base64:
// leerlos solo para saber quién vino acabaría con la cuota del plan gratuito.
import { suiteDb as db } from './suite';

const COLLECTION_NAME = 'asistencia';

export interface Asistencia {
  fecha: string;        // 'YYYY-MM-DD'
  noNomina: string;
  nombreCompleto?: string;
  departamento?: string;
  origen?: string;
  ts?: number;
}

/**
 * Asistencias dentro de un rango de fechas, como un conjunto de claves
 * `${noNomina}|${fecha}` listo para consultar celda por celda.
 *
 * Se filtra por rango en la consulta y no en el cliente: un rol mensual mira
 * 31 días, pero la colección crece con cada revisión de cada persona de la
 * planta, todos los días. Traerla completa sería cada vez más caro sin que
 * nadie notara cuándo empezó a serlo.
 */
export const subscribeAsistenciasRango = (
  fechaDesde: string,
  fechaHasta: string,
  callback: (claves: Set<string>) => void
) => {
  if (!fechaDesde || !fechaHasta) {
    callback(new Set());
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('fecha', '>=', fechaDesde),
    where('fecha', '<=', fechaHasta)
  );
  return onSnapshot(q, (snap) => {
    const claves = new Set<string>();
    snap.docs.forEach(d => {
      const a = d.data() as Asistencia;
      if (a.noNomina && a.fecha) claves.add(`${a.noNomina}|${a.fecha}`);
    });
    callback(claves);
  }, (err) => {
    // Sin esto, un fallo de permisos dejaría el conjunto vacío y la
    // cuadrícula marcaría ausente a toda la planta sin decir por qué.
    console.error('No se pudieron leer las asistencias', err);
    callback(new Set());
  });
};

/**
 * Igual que la suscripción, pero de una sola vez. La usa la exportación, que
 * corre sobre un rol cualquiera de la lista y no sobre el que está abierto,
 * así que no tiene sus asistencias ya cargadas.
 */
export const obtenerAsistenciasRango = async (
  fechaDesde: string,
  fechaHasta: string
): Promise<Set<string>> => {
  const claves = new Set<string>();
  if (!fechaDesde || !fechaHasta) return claves;
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', fechaDesde),
      where('fecha', '<=', fechaHasta)
    ));
    snap.docs.forEach(d => {
      const a = d.data() as Asistencia;
      if (a.noNomina && a.fecha) claves.add(`${a.noNomina}|${a.fecha}`);
    });
  } catch (err) {
    console.error('No se pudieron leer las asistencias para exportar', err);
    throw err;
  }
  return claves;
};
