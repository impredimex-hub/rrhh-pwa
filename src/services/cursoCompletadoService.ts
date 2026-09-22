import { doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { RegistroCursoCompletado, ExclusionCurso } from '../types/rrhh';

const COLLECTION_NAME = 'cursosCompletados';

/**
 * Quién cursó cada curso (SPEC-028).
 *
 * **Un documento por curso, no uno por persona.** Dentro va un mapa
 * `nómina → registro`. Con 122 personas el documento pesa unos 7 KB, y saber
 * quién falta es restarle el padrón que la app ya tiene en memoria.
 *
 * La alternativa —un documento por persona y por curso— daría 122 documentos
 * por curso, y armar la lista de pendientes obligaría a leerlos todos cada vez
 * que alguien abre la pestaña. Es el mismo error que hoy le cuesta a EPP más
 * de un giga al mes.
 *
 * Además solo se lee **el curso que está filtrado**, no todos: sin curso
 * elegido no hay nada que marcar, así que no hay nada que descargar.
 */
export const subscribeCompletados = (
  cursoId: string,
  callback: (
    registros: Record<string, RegistroCursoCompletado>,
    excluidos: Record<string, ExclusionCurso>
  ) => void
) => {
  return onSnapshot(doc(db, COLLECTION_NAME, cursoId), (snap) => {
    const data = snap.data();
    // Quién lo tomó y a quién no le toca viajan en el mismo documento
    // (SPEC-039): no cuesta ni una lectura más.
    callback(
      (data?.registros || {}) as Record<string, RegistroCursoCompletado>,
      (data?.excluidos || {}) as Record<string, ExclusionCurso>
    );
  });
};

/** Quita a alguien de un curso: deja de contar como pendiente (SPEC-039). */
export const excluirDelCurso = async (cursoId: string, nomina: string, reg: ExclusionCurso) => {
  await setDoc(
    doc(db, COLLECTION_NAME, cursoId),
    { id: cursoId, excluidos: { [nomina]: reg }, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
};

/** Lo devuelve a la lista de pendientes. */
export const readmitirEnCurso = async (cursoId: string, nomina: string) => {
  await updateDoc(doc(db, COLLECTION_NAME, cursoId), {
    [`excluidos.${nomina}`]: deleteField(),
    actualizadoEn: serverTimestamp()
  });
};

/**
 * Marca como cursadas a varias personas de una sola vez.
 *
 * Se escribe con `merge` y bajo la clave de cada nómina, así que dos personas
 * capturando el mismo curso al mismo tiempo no se pisan: cada quien toca solo
 * las filas que marcó.
 */
export const guardarCompletados = async (
  cursoId: string,
  nuevos: Record<string, RegistroCursoCompletado>
) => {
  if (!cursoId || Object.keys(nuevos).length === 0) return;

  const registros: Record<string, RegistroCursoCompletado> = {};
  Object.entries(nuevos).forEach(([nomina, reg]) => {
    // `undefined` no se puede guardar en Firestore, y la calificación es
    // opcional: hay cursos sin examen.
    registros[nomina] = reg.calificacion === undefined
      ? { fecha: reg.fecha, porNomina: reg.porNomina || '', porNombre: reg.porNombre || '' }
      : reg;
  });

  await setDoc(
    doc(db, COLLECTION_NAME, cursoId),
    { id: cursoId, registros, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
};

/** Cambia la calificación de alguien ya marcado, sin tocar a los demás. */
export const guardarCalificacion = async (
  cursoId: string,
  nomina: string,
  calificacion: number | undefined
) => {
  await updateDoc(doc(db, COLLECTION_NAME, cursoId), {
    [`registros.${nomina}.calificacion`]: calificacion === undefined ? deleteField() : calificacion,
    actualizadoEn: serverTimestamp()
  });
};

/**
 * Devuelve a alguien a la lista de pendientes.
 *
 * Existe porque marcar es un clic y equivocarse también: sin esta salida, una
 * casilla mal picada dejaría a esa persona como capacitada para siempre.
 */
export const quitarCompletado = async (cursoId: string, nomina: string) => {
  await updateDoc(doc(db, COLLECTION_NAME, cursoId), {
    [`registros.${nomina}`]: deleteField(),
    actualizadoEn: serverTimestamp()
  });
};

/**
 * Cuántos tomaron cada curso, para el calendario de Capacitación (SPEC-033).
 *
 * Lee un documento por curso, y **solo al abrir el calendario**, no al cargar
 * la pestaña: mientras nadie lo pida, no se descarga nada. Con los cursos que
 * suele haber son unas pocas lecturas de unos kilobytes.
 *
 * Un curso sin documento todavía es uno que nadie ha tomado, y cuenta como
 * cero; que falte no es un error.
 */
export const contarCompletadosDeCursos = async (
  cursoIds: string[]
): Promise<Record<string, { tomaron: number; excluidos: string[] }>> => {
  const cuenta: Record<string, { tomaron: number; excluidos: string[] }> = {};
  for (const id of cursoIds) {
    if (!id) continue;
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, id));
      const data = snap.data() || {};
      // También quiénes están fuera del curso: si no, el calendario los
      // contaría como participantes que faltan (SPEC-039).
      cuenta[id] = {
        tomaron: Object.keys(data.registros || {}).length,
        excluidos: Object.keys(data.excluidos || {})
      };
    } catch (err) {
      // Se sigue con los demás: un curso sin número se nota, y detener todo
      // dejaría el calendario en blanco.
      console.error(`No se pudieron leer los completados del curso ${id}`, err);
      cuenta[id] = { tomaron: 0, excluidos: [] };
    }
  }
  return cuenta;
};
