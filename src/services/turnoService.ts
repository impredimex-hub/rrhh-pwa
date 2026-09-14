import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { RolTurnos, PeriodoRol, AsignacionTurno } from '../types/rrhh';
import { FIN_TURNO } from '../types/rrhh';

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

/**
 * ¿Ya terminó este turno?
 *
 * La asistencia no se puede juzgar antes de que acabe la jornada: alguien de
 * T2 entra a las 14:00, y darlo por ausente a las nueve de la mañana sería
 * afirmar una falta que todavía no puede existir. Solo cuando pasó la hora de
 * salida la ausencia de revisión significa algo.
 *
 * Contempla los turnos que cruzan la medianoche (T3 y N12 acaban a las 06:00
 * del día siguiente) y, en LIB, las horas capturadas a mano.
 */
export const turnoYaTermino = (
  fechaISO: string,
  asignacion: AsignacionTurno,
  ahora: Date = new Date()
): boolean => {
  if (!fechaISO || !asignacion) return false;
  const [a, m, d] = fechaISO.split('-').map(Number);
  if (!a || !m || !d) return false;

  let minutosFin: number;

  if (asignacion.turno === 'LIB') {
    const ini = aMinutos(asignacion.horaInicio);
    const fin = aMinutos(asignacion.horaFin);
    // Sin horas capturadas no hay forma de saber cuándo acaba: se trata como
    // no terminado, que es el lado que no inventa faltas.
    if (ini === null || fin === null) return false;
    // Una salida anterior o igual a la entrada significa que cruza la noche.
    minutosFin = fin > ini ? fin : fin + 24 * 60;
  } else {
    minutosFin = FIN_TURNO[asignacion.turno];
    if (minutosFin === undefined) return false;
  }

  // Aritmética de calendario, no suma de milisegundos: el constructor de Date
  // normaliza el desbordamiento de minutos y respeta el horario de verano.
  const fin = new Date(a, m - 1, d, 0, minutosFin, 0, 0);
  return ahora.getTime() >= fin.getTime();
};

const aMinutos = (hhmm?: string): number | null => {
  if (!hhmm) return null;
  const [h, mi] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(mi)) return null;
  return h * 60 + mi;
};
