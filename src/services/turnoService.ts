import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp, getDocs, where } from 'firebase/firestore';
import type { RolResumen } from '../utils/cumplimiento';
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

/**
 * Ficha de historial de cada rol (SPEC-060).
 *
 * Los roles se borran solos al vencer (SPEC-059), y con ellos se perdería si
 * un departamento tuvo rol y si se subió a tiempo. La ficha guarda solo eso:
 * departamento, fechas, quién lo subió y cuándo. No guarda la cuadrícula.
 */
const HISTORIAL = 'rolesHistorial';

const fichaDe = (rol: RolTurnos, id: string) => {
  const dias = diasDelPeriodo(rol.fechaInicio, rol.periodo);
  return {
    id,
    nombre: rol.nombre || '',
    departamento: rol.departamento || '',
    periodo: rol.periodo,
    fechaInicio: dias[0] || rol.fechaInicio || '',
    fechaFin: dias[dias.length - 1] || rol.fechaInicio || '',
    creadoPorNomina: rol.creadoPorNomina || '',
    creadoPorNombre: rol.creadoPorNombre || '',
    actualizadoEn: serverTimestamp()
  };
};

/** No debe impedir guardar o borrar un rol: si falla, se avisa en consola y ya. */
const escribirFicha = async (datos: Record<string, any>, id: string) => {
  try { await setDoc(doc(db, HISTORIAL, id), datos, { merge: true }); }
  catch (e) { console.warn('No se pudo escribir la ficha de historial del rol:', e); }
};

export const saveRolTurnos = async (rol: RolTurnos) => {
  const nuevo = !rol.id;
  const docRef = rol.id ? doc(db, COLLECTION_NAME, rol.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...rol,
    id: docRef.id,
    createdAt: serverTimestamp(),
    // `createdAt` se reescribe en cada guardado; `subidoEn` solo al crear, y
    // es lo que dice si el rol se subió antes de empezar su periodo.
    ...(nuevo ? { subidoEn: serverTimestamp() } : {})
  }, { merge: true });
  await escribirFicha({ ...fichaDe(rol, docRef.id), ...(nuevo ? { subidoEn: serverTimestamp() } : {}) }, docRef.id);
};

/**
 * Borrado a mano: quien lo borra dice que el rol estaba mal, así que su ficha
 * se va también. Si se quedara, el historial diría que ese departamento tuvo
 * rol con un rol que nunca valió.
 */
export const deleteRolTurnos = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  try { await deleteDoc(doc(db, HISTORIAL, id)); }
  catch (e) { console.warn('No se pudo borrar la ficha de historial del rol:', e); }
};

/** Milisegundos de un Timestamp de Firestore, o null si no hay dato. */
const ms = (t: any): number | null =>
  t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : null);

/** Resumen de un rol vivo, con la misma forma que una ficha de historial. */
export const resumenDeRol = (rol: RolTurnos): RolResumen => {
  const f = fichaDe(rol, rol.id || '');
  return {
    id: f.id, nombre: f.nombre, departamento: f.departamento,
    fechaInicio: f.fechaInicio, fechaFin: f.fechaFin,
    creadoPorNombre: f.creadoPorNombre, subidoEn: ms((rol as any).subidoEn)
  };
};

/** Fichas de historial de roles que terminan en `desde` o después. */
export const obtenerHistorialRoles = async (desde: string): Promise<RolResumen[]> => {
  const snap = await getDocs(query(collection(db, HISTORIAL), where('fechaFin', '>=', desde)));
  return snap.docs.map(d => {
    const x: any = d.data();
    return {
      id: d.id, nombre: x.nombre || '', departamento: x.departamento || '',
      fechaInicio: x.fechaInicio || '', fechaFin: x.fechaFin || '',
      creadoPorNombre: x.creadoPorNombre || '', subidoEn: ms(x.subidoEn)
    };
  });
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

/**
 * ¿Ya pasó por completo el periodo de este rol? (SPEC-059)
 *
 * Vence cuando terminó el último día **y** también los turnos de ese día: T3
 * y N12 acaban a las 06:00 del día siguiente, así que un rol cuyo último día
 * es el domingo sigue vigente hasta el lunes a esa hora. Un turno LIB sin
 * horas capturadas no dice cuándo acaba; para no quedarse esperando para
 * siempre, el rol vence de todos modos dos días después del último.
 */
export const rolVencido = (rol: RolTurnos, ahora: Date = new Date()): boolean => {
  const dias = diasDelPeriodo(rol.fechaInicio, rol.periodo);
  const ultimo = dias[dias.length - 1];
  if (!ultimo) return false;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = iso(ahora);
  if (hoy <= ultimo) return false;

  const [a, m, d] = ultimo.split('-').map(Number);
  if (hoy > iso(new Date(a, m - 1, d + 2))) return true;

  return Object.entries(rol.asignaciones || {})
    .filter(([clave]) => clave.endsWith('|' + ultimo))
    .every(([, asig]) => turnoYaTermino(ultimo, asig, ahora));
};

/**
 * Borra para siempre los roles cuyo periodo ya pasó (SPEC-059). Devuelve
 * cuántos borró. Un fallo en uno no detiene a los demás.
 */
export const purgarRolesVencidos = async (roles: RolTurnos[], excepto?: string): Promise<number> => {
  const vencidos = roles.filter(r => r.id && r.id !== excepto && rolVencido(r));
  let n = 0;
  for (const r of vencidos) {
    try {
      // Antes de borrarlo se asegura su ficha (los roles anteriores a la
      // SPEC-060 no la tienen). Se borra solo el rol: la ficha se queda.
      const sub = (r as any).subidoEn;
      await escribirFicha({ ...fichaDe(r, r.id!), ...(sub ? { subidoEn: sub } : {}) }, r.id!);
      await deleteDoc(doc(db, COLLECTION_NAME, r.id!));
      n++;
    }
    catch (e) { console.warn('No se pudo borrar el rol vencido ' + r.nombre + ':', e); }
  }
  return n;
};

const aMinutos = (hhmm?: string): number | null => {
  if (!hhmm) return null;
  const [h, mi] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(mi)) return null;
  return h * 60 + mi;
};
