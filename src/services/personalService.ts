import { collection, doc, writeBatch, setDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Colaborador } from '../types/rrhh';

const COLLECTION_NAME = 'colaboradores';

// Escucha en tiempo real (instantáneo)
export const subscribeColaboradores = (callback: (data: Colaborador[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('noNomina', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Colaborador));
    callback(data);
  });
};

export const saveColaborador = async (colaborador: Colaborador) => {
  const docId = colaborador.noNomina.trim();
  const docRef = doc(db, COLLECTION_NAME, docId);
  await setDoc(docRef, {
    ...colaborador,
    noNomina: docId,
    createdAt: colaborador.createdAt || serverTimestamp()
  }, { merge: true });
};

export const batchUploadColaboradores = async (colaboradores: Colaborador[]) => {
  const batch = writeBatch(db);
  
  colaboradores.forEach((colab) => {
    const docId = colab.noNomina.toString().trim();
    if (!docId) return;
    
    const docRef = doc(db, COLLECTION_NAME, docId);
    batch.set(docRef, {
      ...colab,
      noNomina: docId,
      estatus: colab.estatus || 'ACTIVO',
      createdAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
};