import { collection, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Vacante } from '../types/rrhh';

const COLLECTION_NAME = 'vacantes';

export const subscribeVacantes = (callback: (data: Vacante[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('departamento', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vacante));
    callback(data);
  });
};

export const saveVacante = async (vacante: Vacante) => {
  const docRef = vacante.id ? doc(db, COLLECTION_NAME, vacante.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...vacante,
    id: docRef.id,
    fechaCreacion: vacante.fechaCreacion || new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deleteVacante = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
