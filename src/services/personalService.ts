import { collection, doc, writeBatch, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Colaborador } from '../types/rrhh';

const COLLECTION_NAME = 'colaboradores';

// Función para ordenar numéricamente por # Nómina
export const ordenarPorNomina = (lista: Colaborador[]): Colaborador[] => {
  return [...lista].sort((a, b) => {
    const numA = parseInt(String(a.noNomina).replace(/\D/g, ''), 10);
    const numB = parseInt(String(b.noNomina).replace(/\D/g, ''), 10);
    
    if (isNaN(numA) && isNaN(numB)) return String(a.noNomina).localeCompare(String(b.noNomina));
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });
};

// Suscribirse a cambios en tiempo real
export const subscribeColaboradores = (callback: (data: Colaborador[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
    callback(ordenarPorNomina(data));
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

export const saveColaborador = async (colaborador: Colaborador) => {
  await saveColaboradoresBatch([colaborador]);
};

export const deleteColaborador = async (noNomina: string) => {
  const docRef = doc(db, COLLECTION_NAME, String(noNomina).trim());
  await deleteDoc(docRef);
};
