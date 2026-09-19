import { doc, setDoc, onSnapshot, getDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AsistenciaManual } from '../types/rrhh';

const COLLECTION_NAME = 'asistenciaManual';

/** Clave de una corrección: `nómina_fecha`. Sin puntos, para que sea un id válido. */
export const claveManual = (noNomina: string, fecha: string) => `${String(noNomina).trim()}_${fecha}`;

/**
 * Los meses `AAAA-MM` que toca un rango de fechas.
 *
 * Se recorre por texto y no con `Date` (regla R3): las fechas ya vienen en
 * `AAAA-MM-DD`, y construir fechas solo para avanzar de mes reintroduciría el
 * error de zona horaria.
 */
export const mesesDelRango = (desde: string, hasta: string): string[] => {
  if (!desde || !hasta || desde > hasta) return [];
  const meses: string[] = [];
  let anio = Number(desde.slice(0, 4));
  let mes = Number(desde.slice(5, 7));
  const fin = hasta.slice(0, 7);
  for (let i = 0; i < 120; i++) {           // tope de seguridad: diez años
    const actual = `${anio}-${String(mes).padStart(2, '0')}`;
    meses.push(actual);
    if (actual >= fin) break;
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }
  }
  return meses;
};

/**
 * Asistencias corregidas a mano (SPEC-032).
 *
 * **Un documento por mes**, con un mapa `nómina_fecha → corrección` adentro.
 * Un rango semanal o quincenal toca uno o dos documentos; uno mensual, uno.
 * Un documento por corrección obligaría a consultar la colección entera cada
 * vez que se cuentan faltas, que es en tres lugares distintos de la pestaña.
 *
 * Se esperan pocas: existen solo para cuando no se hizo la revisión de EPP y
 * la persona sí vino a trabajar.
 */
export const obtenerManualesRango = async (desde: string, hasta: string): Promise<Set<string>> => {
  const claves = new Set<string>();
  for (const mes of mesesDelRango(desde, hasta)) {
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, mes));
      const registros = (snap.data()?.registros || {}) as Record<string, AsistenciaManual>;
      Object.values(registros).forEach(r => {
        if (r?.noNomina && r?.fecha && r.fecha >= desde && r.fecha <= hasta) {
          claves.add(`${r.noNomina}|${r.fecha}`);
        }
      });
    } catch (err) {
      // Si un mes no se puede leer se sigue con los demás: perder una
      // corrección hace aparecer una falta de más, que se ve y se corrige.
      // Detener todo dejaría la pestaña sin números.
      console.error(`No se pudieron leer las asistencias corregidas de ${mes}`, err);
    }
  }
  return claves;
};

/** Las correcciones de un rango, completas, para poder mostrarlas y deshacerlas. */
export const obtenerManualesDetalle = async (desde: string, hasta: string): Promise<AsistenciaManual[]> => {
  const filas: AsistenciaManual[] = [];
  for (const mes of mesesDelRango(desde, hasta)) {
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, mes));
      const registros = (snap.data()?.registros || {}) as Record<string, AsistenciaManual>;
      Object.values(registros).forEach(r => {
        if (r?.noNomina && r?.fecha && r.fecha >= desde && r.fecha <= hasta) filas.push(r);
      });
    } catch (err) {
      console.error(`No se pudieron leer las asistencias corregidas de ${mes}`, err);
    }
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.noNomina.localeCompare(b.noNomina));
};

/** Versión en vivo, para la cuadrícula del rol que está abierto. */
export const subscribeManualesMes = (
  mes: string,
  callback: (claves: Set<string>) => void
) => {
  if (!mes) { callback(new Set()); return () => {}; }
  return onSnapshot(doc(db, COLLECTION_NAME, mes), (snap) => {
    const claves = new Set<string>();
    const registros = (snap.data()?.registros || {}) as Record<string, AsistenciaManual>;
    Object.values(registros).forEach(r => {
      if (r?.noNomina && r?.fecha) claves.add(`${r.noNomina}|${r.fecha}`);
    });
    callback(claves);
  }, (err) => {
    console.error('No se pudieron leer las asistencias corregidas', err);
    callback(new Set());
  });
};

/**
 * Da por presente a alguien a quien no le hicieron revisión de EPP.
 *
 * Se guarda el motivo y quién lo hizo, y eso es lo que sostiene la corrección:
 * las reglas de Firestore no distinguen usuarios (regla R6), así que la única
 * defensa real de este permiso es que cada uso quede firmado.
 */
export const marcarAsistenciaManual = async (reg: AsistenciaManual) => {
  const mes = reg.fecha.slice(0, 7);
  await setDoc(
    doc(db, COLLECTION_NAME, mes),
    {
      mes,
      registros: { [claveManual(reg.noNomina, reg.fecha)]: { ...reg, creadoEn: Date.now() } },
      actualizadoEn: serverTimestamp()
    },
    { merge: true }
  );
};

/** Deshace una corrección: esa persona vuelve a contar como falta. */
export const quitarAsistenciaManual = async (noNomina: string, fecha: string) => {
  const mes = fecha.slice(0, 7);
  await setDoc(
    doc(db, COLLECTION_NAME, mes),
    {
      registros: { [claveManual(noNomina, fecha)]: deleteField() },
      actualizadoEn: serverTimestamp()
    },
    { merge: true }
  );
};
