import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Incidencia } from '../types/rrhh';

const COLLECTION_NAME = 'incidencias';

export const subscribeIncidencias = (callback: (data: Incidencia[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('fechaInicio', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incidencia));
    callback(data);
  });
};

export const saveIncidencia = async (incidencia: Incidencia) => {
  const docRef = incidencia.id ? doc(db, COLLECTION_NAME, incidencia.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...incidencia,
    id: docRef.id,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deleteIncidencia = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
