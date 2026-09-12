import { collection, doc, setDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Incidencia } from '../types/rrhh';

const COLLECTION_NAME = 'incidencias';

export const subscribeIncidencias = (callback: (data: Incidencia[]) => void) => {
  // Ya no se ordena en la consulta: Firestore excluye de un orderBy(campo) a
  // cualquier documento que no tenga ese campo, y los registros de antes de
  // esta versión no tienen fechaInicio ni necesariamente createdAt. Se ordena
  // en el cliente para no perder ninguno del historial en silencio.
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incidencia));
    data.sort((a: any, b: any) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
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
