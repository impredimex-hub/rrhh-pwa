import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { RolTurnos, PeriodoRol } from '../types/rrhh';

const COLLECTION_NAME = 'rolesTurnos';

export const subscribeRolesTurnos = (callback: (data: RolTurnos[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RolTurnos));
    // Más reciente primero, por fecha de inicio del periodo.
    data.sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
    callback(data);
  });
};

export const saveRolTurnos = async (rol: RolTurnos) => {
  const docRef = rol.id ? doc(db, COLLECTION_NAME, rol.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...rol,
    id: docRef.id,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deleteRolTurnos = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};

/**
 * Días que abarca un periodo a partir de su fecha de inicio, en 'YYYY-MM-DD'.
 *
 * Las fechas se construyen con aritmética de calendario y no sumando
 * milisegundos: en México el horario de verano haría que un día durara 23 o 25
 * horas dos veces al año, y sumar 86.400.000 ms repetiría o saltaría un día.
 */
export const diasDelPeriodo = (fechaInicio: string, periodo: PeriodoRol): string[] => {
  if (!fechaInicio) return [];
  const [a, m, d] = fechaInicio.split('-').map(Number);
  if (!a || !m || !d) return [];

  const cuantos =
    periodo === 'SEMANAL' ? 7 :
    periodo === 'QUINCENAL' ? 14 :
    // Mensual: los días naturales del mes de la fecha de inicio.
    new Date(a, m, 0).getDate();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const dias: string[] = [];

  if (periodo === 'MENSUAL') {
    // El mes completo, del día 1 al último, sin importar en qué día caiga
    // la fecha de inicio.
    for (let i = 1; i <= cuantos; i++) dias.push(`${a}-${pad(m)}-${pad(i)}`);
    return dias;
  }

  for (let i = 0; i < cuantos; i++) {
    const f = new Date(a, m - 1, d + i); // el constructor normaliza el desbordamiento de mes
    dias.push(`${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`);
  }
  return dias;
};

/** Clave de una celda de la cuadrícula. */
export const claveCelda = (noNomina: string, fechaISO: string) => `${noNomina}|${fechaISO}`;
