import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PromocionInterna } from '../types/rrhh';

const COLLECTION_NAME = 'promociones';

export const subscribePromociones = (callback: (data: PromocionInterna[]) => void) => {
  // Sin orderBy en la consulta: Firestore excluye de un orderBy a cualquier
  // documento que no tenga ese campo, y un registro incompleto desaparecería
  // de la lista sin dar ningún error. Se ordena aquí.
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PromocionInterna));
    data.sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
    callback(data);
  });
};

export const savePromocion = async (promocion: PromocionInterna) => {
  const docRef = promocion.id
    ? doc(db, COLLECTION_NAME, promocion.id)
    : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...promocion,
    id: docRef.id,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deletePromocion = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};

/**
 * Fechas en que toca cada una de las tres evaluaciones mensuales: al cumplir
 * uno, dos y tres meses desde el inicio.
 *
 * Se usa aritmética de calendario y no suma de días, para que «un mes» sea un
 * mes real. Si el día no existe en el mes destino —un inicio el 31 de enero,
 * cuyo mes siguiente sería el 31 de febrero— el constructor de Date desborda
 * al mes que sigue, así que se recorta al último día del mes correcto.
 */
export const fechasEvaluaciones = (fechaInicio: string): string[] => {
  if (!fechaInicio) return [];
  const [a, m, d] = fechaInicio.split('-').map(Number);
  if (!a || !m || !d) return [];

  const pad = (n: number) => n.toString().padStart(2, '0');
  const salida: string[] = [];

  for (let i = 1; i <= 3; i++) {
    const mesObjetivo = m - 1 + i;            // base 0
    const anio = a + Math.floor(mesObjetivo / 12);
    const mes = ((mesObjetivo % 12) + 12) % 12;
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    salida.push(`${anio}-${pad(mes + 1)}-${pad(Math.min(d, ultimoDia))}`);
  }
  return salida;
};

/** Promedio de las calificaciones capturadas, o null si no hay ninguna. */
export const promedioCalificaciones = (calificaciones: Record<string, number>): number | null => {
  const valores = Object.values(calificaciones || {}).filter(v => typeof v === 'number' && !isNaN(v));
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
};
