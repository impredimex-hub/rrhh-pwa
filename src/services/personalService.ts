import { collection, doc, writeBatch, deleteDoc, updateDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Colaborador } from '../types/rrhh';
import { normalizarNombre } from '../utils/catalogos';

const COLLECTION_NAME = 'colaboradores';

/**
 * Campos que esta aplicación escribe. Todo lo demás que exista en el documento
 * —`apps`, `roles`, `rol`, `creadoEn`— se conserva intacto.
 *
 * La lista es explícita a propósito. Antes se guardaba con `...colaborador`, y
 * los permisos sobrevivían únicamente porque la escritura usaba `merge`. Eso
 * dejaba el padrón de las cinco aplicaciones colgando de una sola opción que
 * cualquiera podía quitar sin darse cuenta de lo que sostenía.
 *
 * Los nombres de los campos de auditoría son los que ya usa la colección de la
 * suite: `actualizadoEn` y `actualizadoPor`, no `updatedAt`.
 */
const construirDocumento = (colab: Colaborador, autor: string, esAlta: boolean) => ({
  noNomina: String(colab.noNomina).trim(),
  nombreCompleto: (colab.nombreCompleto || '').trim(),
  // Palabras del nombre en orden alfabético. Ver normalizarNombre: si esto se
  // calculara de otra forma, las búsquedas de las demás apps fallarían a medias.
  nombreNormalizado: normalizarNombre(colab.nombreCompleto || ''),
  puesto: (colab.puesto || '').trim(),
  fechaIngreso: colab.fechaIngreso || '',
  departamento: (colab.departamento || '').trim(),
  // Sin `estatus` el campo no se escribe y el documento conserva el suyo.
  ...(colab.estatus ? { estatus: colab.estatus } : {}),
  ...(esAlta ? { creadoEn: serverTimestamp() } : {}),
  actualizadoEn: serverTimestamp(),
  actualizadoPor: autor
});

/** Ordena numéricamente por número de nómina. */
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

export const subscribeColaboradores = (callback: (data: Colaborador[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador));
    callback(ordenarPorNomina(data));
  });
};

/**
 * Guarda en lote, siempre con `merge` y con la lista blanca de campos.
 *
 * @param autor         Nómina de quien hace el cambio. Queda en el documento;
 *                      hasta ahora no había forma de saber quién tocó el padrón.
 * @param nominasNuevas Nóminas que son alta. Solo a esas se les pone `creadoEn`.
 */
export const saveColaboradoresBatch = async (
  colaboradores: Colaborador[],
  autor: string,
  nominasNuevas: Set<string> = new Set()
) => {
  const batch = writeBatch(db);

  colaboradores.forEach((colab) => {
    const docId = String(colab.noNomina).trim();
    batch.set(
      doc(db, COLLECTION_NAME, docId),
      construirDocumento(colab, autor, nominasNuevas.has(docId)),
      { merge: true }
    );
  });

  await batch.commit();
};

export const saveColaborador = async (colaborador: Colaborador, autor: string, esAlta = false) => {
  const docId = String(colaborador.noNomina).trim();
  await saveColaboradoresBatch([colaborador], autor, esAlta ? new Set([docId]) : new Set());
};

/**
 * Dar de baja o reactivar. Es la vía normal: conserva el documento completo,
 * el historial y los permisos, y se puede revertir.
 */
export const cambiarEstatus = async (noNomina: string, estatus: 'ACTIVO' | 'BAJA', autor: string) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    estatus,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Borrado definitivo. Se lleva el documento completo, incluidos `apps` y
 * `roles`, así que esa persona pierde el acceso a las demás aplicaciones sin
 * dejar rastro. Existe solo para registros creados por error; para una salida
 * real de la empresa se usa `cambiarEstatus`.
 */
export const deleteColaborador = async (noNomina: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()));
};
