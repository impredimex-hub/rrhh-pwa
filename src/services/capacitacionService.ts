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

export const subscribeCursos = (callback: (data: CursoCapacitacion[]) => void) => {
  _suscriptores.add(callback);
  if (_cursos) callback(_cursos);

  if (!_escuchaCursos) {
    _escuchaCursos = onSnapshot(
      query(collection(db, COLLECTION_NAME), orderBy('fechaInicio', 'asc')),
      (snapshot) => {
        _cursos = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CursoCapacitacion));
        _suscriptores.forEach(cb => cb(_cursos!));
      },
      (err) => { console.error('No se pudieron leer los cursos:', err); }
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
