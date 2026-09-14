import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Suceso } from '../types/rrhh';

const COLLECTION_NAME = 'sucesos';

export const subscribeSucesos = (callback: (data: Suceso[]) => void) => {
  // Sin orderBy en la consulta: Firestore deja fuera de un orderBy a cualquier
  // documento que no tenga ese campo, y así un registro incompleto
  // desaparecería de la bitácora sin dar ningún error. Se ordena aquí.
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Suceso));
    data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    callback(data);
  });
};

export const saveSuceso = async (suceso: Suceso) => {
  const docRef = suceso.id ? doc(db, COLLECTION_NAME, suceso.id) : doc(collection(db, COLLECTION_NAME));
  await setDoc(docRef, {
    ...suceso,
    id: docRef.id,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const deleteSuceso = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
