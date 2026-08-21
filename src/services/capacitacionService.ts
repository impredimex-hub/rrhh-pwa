import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CursoCapacitacion } from '../types/rrhh';

const COLLECTION_NAME = 'capacitaciones';

export const subscribeCursos = (callback: (data: CursoCapacitacion[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('fechaInicio', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CursoCapacitacion));
    callback(data);
  });
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
