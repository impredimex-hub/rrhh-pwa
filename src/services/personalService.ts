import { collection, doc, writeBatch, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Colaborador } from '../types/rrhh';

const COLLECTION_NAME = 'colaboradores';

// Suscribirse a cambios en tiempo real
export const subscribeColaboradores = (callback: (data: Colaborador[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('noNomina', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
    callback(data);
  });
};

// Guardar colaboradores individualmente o en lote
export const saveColaboradoresBatch = async (colaboradores: Colaborador[]) => {
  const batch = writeBatch(db);

  colaboradores.forEach((colab) => {
    const docId = String(colab.noNomina).trim();
    const docRef = doc(db, COLLECTION_NAME, docId);
    batch.set(docRef, {
      ...colab,
      noNomina: docId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
};

// Guardar un solo colaborador
export const saveColaborador = async (colaborador: Colaborador) => {
  await saveColaboradoresBatch([colaborador]);
};

// Eliminar colaborador por nómina
export const deleteColaborador = async (noNomina: string) => {
  const docRef = doc(db, COLLECTION_NAME, String(noNomina).trim());
  await deleteDoc(docRef);
};
