import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CursoCapacitacion } from '../types/rrhh';

const COLLECTION_NAME = 'capacitaciones';

/* Una sola escucha para todos, por lo mismo que el padrón (SPEC-043):
   Capacitación y Cursos se suscriben a lo mismo, y cambiar de pestaña volvía
   a leer la colección entera. */
let _escuchaCursos: (() => void) | null = null;
let _cursos: CursoCapacitacion[] | null = null;
const _suscriptores = new Set<(data: CursoCapacitacion[]) => void>();

let _reintentos = 0;
let _temporizador: ReturnType<typeof setTimeout> | null = null;

/** Vuelve a abrir la escucha: 5 s, 10 s, 20 s… hasta un minuto. */
function programarReintento() {
  if (_temporizador) return;
  const espera = Math.min(5000 * Math.pow(2, _reintentos), 60000);
  _reintentos++;
  _temporizador = setTimeout(() => {
    _temporizador = null;
    const receptores = Array.from(_suscriptores);
    _suscriptores.clear();
    receptores.forEach(cb => { subscribeCursos(cb); });
  }, espera);
}

export const subscribeCursos = (callback: (data: CursoCapacitacion[]) => void) => {
  _suscriptores.add(callback);
  if (_cursos) callback(_cursos);

  if (!_escuchaCursos) {
    _escuchaCursos = onSnapshot(
      query(collection(db, COLLECTION_NAME), orderBy('fechaInicio', 'asc')),
      (snapshot) => {
        _reintentos = 0;
        _cursos = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CursoCapacitacion));
        _suscriptores.forEach(cb => cb(_cursos!));
      },
      (err) => {
        /* Una escucha que falla queda muerta: Firestore no vuelve a mandar
           nada por ella. Antes se conservaba la referencia como si siguiera
           viva, así que nadie abría otra y todos se quedaban con lo último
           leído, sin enterarse. Aquí se suelta y se vuelve a intentar, con
           esperas cada vez más largas para no insistir contra una red caída. */
        console.error('No se pudo leer %s:', 'los cursos', err);
        if (_escuchaCursos) { try { _escuchaCursos(); } catch { /* ya estaba cerrada */ } }
        _escuchaCursos = null;
        if (_suscriptores.size > 0) programarReintento();
      }
    );
  }

  return () => { _suscriptores.delete(callback); };
};

export const saveCurso = async (curso: CursoCapacitacion) => {
  const docRef = curso.id ? doc(db, COLLECTION_NAME, curso.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...curso,
    id: docRef.id,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deleteCurso = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
