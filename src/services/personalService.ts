import { collection, doc, writeBatch, deleteDoc, updateDoc, getDoc, setDoc, query, onSnapshot, serverTimestamp, deleteField } from 'firebase/firestore';
// El padrón vive en el proyecto compartido de la suite, no en el propio de
// RRHH. Es la única lista de personal válida de las cinco aplicaciones, y esta
// es la única app que la escribe.
//
// Lo pesado de RRHH —incidencias, cursos, capacitación, vacantes— se queda en
// `firebase/config`, o sea en el proyecto rrhh-pwa. Es deliberado: el plan
// gratuito da cuota por proyecto, y concentrar las cinco apps en uno la
// colapsaría. La suite solo carga con identidad y directorio.
import { suiteDb as db } from './suite';
import type { Colaborador } from '../types/rrhh';
import { normalizarNombre } from '../utils/catalogos';
import { partesFecha, hoyISO } from '../utils/fechas';

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
  // Igual que `estatus`: si no viene, no se escribe. Así un Excel del
  // directorio sin la columna de nacimiento no borra los cumpleaños cargados.
  ...(colab.fechaNacimiento ? { fechaNacimiento: colab.fechaNacimiento } : {}),
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

/* ── El padrón se lee una sola vez por sesión (SPEC-043) ──────────────────
   Siete pestañas se suscriben al padrón, y al cambiar de pestaña React
   desmonta una y monta otra. Con una suscripción por módulo, cada cambio de
   pestaña volvía a leer los 122 documentos: veinte cambios eran 2 440
   lecturas por persona, y el proyecto de la suite llegó a 52 000 en un día
   contra un límite de 50 000.

   Ahora todos comparten **una sola escucha**. Quien llega después recibe de
   inmediato lo último que se leyó, sin tocar la red. */
let _escuchaPadron: (() => void) | null = null;
let _padron: Colaborador[] | null = null;
const _suscriptores = new Set<(data: Colaborador[]) => void>();

let _reintentos = 0;
let _temporizador: ReturnType<typeof setTimeout> | null = null;

/** Vuelve a abrir la escucha: 5 s, 10 s, 20 s… hasta un minuto. */
function programarReintento() {
  if (_temporizador) return;
  const espera = Math.min(5000 * Math.pow(2, _reintentos), 60000);
  _reintentos++;
  _temporizador = setTimeout(() => {
    _temporizador = null;
    const receptores = Array.from(_suscriptores);
    _suscriptores.clear();
    receptores.forEach(cb => { subscribeColaboradores(cb); });
  }, espera);
}

export const subscribeColaboradores = (callback: (data: Colaborador[]) => void) => {
  _suscriptores.add(callback);

  // Lo ya leído, al instante: cambiar de pestaña no cuesta ninguna lectura.
  if (_padron) callback(_padron);

  if (!_escuchaPadron) {
    _escuchaPadron = onSnapshot(
      query(collection(db, COLLECTION_NAME)),
      (snapshot) => {
        _reintentos = 0;
        _padron = ordenarPorNomina(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));
        _suscriptores.forEach(cb => cb(_padron!));
      },
      (err) => {
        /* Una escucha que falla queda muerta: Firestore no vuelve a mandar
           nada por ella. Antes se conservaba la referencia como si siguiera
           viva, así que nadie abría otra y todos se quedaban con lo último
           leído, sin enterarse. Aquí se suelta y se vuelve a intentar, con
           esperas cada vez más largas para no insistir contra una red caída. */
        console.error('No se pudo leer %s:', 'el padrón', err);
        if (_escuchaPadron) { try { _escuchaPadron(); } catch { /* ya estaba cerrada */ } }
        _escuchaPadron = null;
        if (_suscriptores.size > 0) programarReintento();
      }
    );
  }

  /* Al desuscribirse solo se quita este receptor: **la escucha sigue viva**.
     Cerrarla al salir de la pestaña obligaría a leer todo otra vez al
     volver, que es justo lo que se quiere evitar. Una escucha abierta solo
     cobra los documentos que cambian. Muere al recargar la página. */
  return () => { _suscriptores.delete(callback); };
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
export const cambiarEstatus = async (
  noNomina: string,
  estatus: 'ACTIVO' | 'BAJA',
  autor: string,
  fecha?: string
) => {
  // Se anota el día de la baja porque `actualizadoEn` no sirve para medir
  // rotación: cambia con cualquier edición, así que una baja vieja parecería
  // reciente en cuanto alguien corrija el puesto de esa persona. Al reingresar,
  // el campo se borra para no arrastrar una baja que ya no existe.
  //
  // La fecha se puede dar (SPEC-023): alguien puede salir un viernes y que la
  // baja se capture el lunes. Si no viene, o viene mal, se usa la de hoy, que
  // es el comportamiento que tenía esta función desde el principio.
  const dia = partesFecha(fecha) ? String(fecha) : hoyISO();

  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    estatus,
    fechaBaja: estatus === 'BAJA' ? dia : deleteField(),
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Corrige o completa la fecha de una baja que ya está marcada (SPEC-023).
 *
 * Existe por las bajas anteriores a la versión 2.11.0, cuando `fechaBaja`
 * todavía no se registraba: esas personas están en el padrón como BAJA pero sin
 * día, así que no aparecen en la gráfica de rotación. El dato no se puede
 * deducir del sistema —`actualizadoEn` cambia con cualquier edición— y solo lo
 * tiene quien lleve el archivo de nómina.
 *
 * No toca `estatus`. Quien no esté dado de baja no tiene por qué recibir una
 * fecha de baja, y la comprobación se hace arriba, en la pantalla.
 *
 * Como `fechaBaja`, tampoco viaja en `construirDocumento`: si lo hiciera, una
 * importación de Excel sin esa columna borraría de un golpe todas las fechas
 * que se hayan capturado a mano.
 */
export const fecharBaja = async (noNomina: string, fecha: string, autor: string) => {
  if (!partesFecha(fecha)) {
    throw new Error('La fecha de baja debe venir como AAAA-MM-DD.');
  }

  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    fechaBaja: String(fecha),
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Cambia el número de nómina de una persona.
 *
 * No es una edición como las demás: la nómina es el identificador del
 * documento, así que hay que crear uno nuevo y borrar el anterior. Se copia
 * **todo** lo que tenía —incluidos `apps`, `roles` y `creadoEn`—, porque si no
 * esa persona perdería el acceso a las aplicaciones de la suite.
 *
 * Lo que esta función **no** puede hacer es mover la cuenta de Firebase Auth,
 * que es `<nomina>@impredimex.local`. Desde el navegador no se puede borrar ni
 * renombrar la cuenta de otra persona. Hay que rehacerla a mano en la consola,
 * o esa persona no podrá volver a entrar a ninguna aplicación.
 */
export const cambiarNomina = async (
  nominaVieja: string,
  datosNuevos: Colaborador,
  autor: string
) => {
  const vieja = String(nominaVieja).trim();
  const nueva = String(datosNuevos.noNomina).trim();
  if (vieja === nueva) return;

  const refVieja = doc(db, COLLECTION_NAME, vieja);
  const refNueva = doc(db, COLLECTION_NAME, nueva);

  const [snapVieja, snapNueva] = await Promise.all([getDoc(refVieja), getDoc(refNueva)]);
  if (!snapVieja.exists()) throw new Error('No se encontró la nómina ' + vieja);
  if (snapNueva.exists())  throw new Error('La nómina ' + nueva + ' ya está ocupada por otra persona.');

  const previo = snapVieja.data() || {};

  // Primero se crea el documento nuevo y solo después se borra el viejo. Si
  // algo falla en medio queda duplicado y se resuelve a mano; al revés se
  // perdería a la persona.
  await setDoc(refNueva, {
    ...previo,                                   // conserva apps, roles y creadoEn
    ...construirDocumento(datosNuevos, autor, false),
    nominaAnterior: vieja                        // deja rastro del cambio
  });
  await deleteDoc(refVieja);
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

/**
 * Departamentos cuyos roles de turnos puede programar una persona (SPEC-013).
 *
 * Va aparte de `construirDocumento` a propósito: ese es el camino de la
 * importación y de la edición del padrón, y si este campo viajara ahí, un
 * Excel sin la columna lo borraría en cada carga. Aquí se escribe solo cuando
 * alguien lo cambia deliberadamente desde la pantalla de permisos.
 */
export const asignarAreasACargo = async (
  noNomina: string,
  areas: string[],
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    areasACargo: areas,
    // El campo viejo se deja igual a propósito: si alguien abre una versión
    // anterior de la app mientras se termina el cambio, sigue viendo lo mismo.
    departamentosTurnos: areas,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Las áreas a cargo de una persona, en mayúsculas y sin espacios sobrantes.
 *
 * Lee el campo nuevo y cae al viejo mientras queden documentos sin migrar.
 * Un solo lugar para esa transición: si estuviera repetido en cada pantalla,
 * alguna se quedaría sin actualizar y esa persona perdería sus áreas sin que
 * nadie entendiera por qué.
 */
export const areasACargoDe = (c?: { areasACargo?: string[]; departamentosTurnos?: string[] } | null): string[] =>
  ((c?.areasACargo ?? c?.departamentosTurnos) || []).map(d => d.trim().toUpperCase()).filter(Boolean);

/**
 * Marca de «puede ver el reporte de faltas de todas las áreas» (SPEC-015).
 *
 * Va aparte de `construirDocumento` por la misma razón que
 * `departamentosTurnos`: ese es el camino de la importación de Excel, y un
 * archivo sin la columna borraría la marca en cada carga.
 */
export const asignarReporteFaltasTodas = async (
  noNomina: string,
  puede: boolean,
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    reporteFaltasTodas: puede,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Marca de «puede capturar promociones internas» (SPEC-016).
 *
 * Aparte de `construirDocumento`, igual que los otros permisos: si viajara por
 * ahí, un Excel sin esa columna lo borraría en cada importación.
 */
export const asignarCapturaPromociones = async (
  noNomina: string,
  puede: boolean,
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    capturaPromociones: puede,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

/**
 * Carga masiva de fechas de nacimiento (SPEC-017).
 *
 * Escribe **únicamente** `fechaNacimiento`, y por eso va aparte de
 * `construirDocumento`. La base de cumpleaños de la empresa trae nómina y
 * fecha, sin puesto ni departamento ni fecha de ingreso; si pasara por la
 * importación normal del directorio, las filas se rechazarían por no traer
 * departamento, y las que sí lo trajeran vaciarían el puesto y la fecha de
 * ingreso de esa gente. Este camino no puede tocar nada más.
 *
 * Solo actualiza documentos que ya existen: una fecha de cumpleaños no basta
 * para dar de alta a nadie.
 */
export const guardarFechasNacimiento = async (
  pares: { noNomina: string; fechaNacimiento: string }[],
  autor: string
) => {
  // Firestore admite 500 operaciones por lote; el padrón ronda las 122
  // personas, pero el corte evita que crezca hasta romperse sin avisar.
  const trozos: typeof pares[] = [];
  for (let i = 0; i < pares.length; i += 400) trozos.push(pares.slice(i, i + 400));

  for (const trozo of trozos) {
    const batch = writeBatch(db);
    trozo.forEach(({ noNomina, fechaNacimiento }) => {
      batch.update(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
        fechaNacimiento,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: autor
      });
    });
    await batch.commit();
  }
};

/**
 * Concede o retira el permiso de ver las gráficas (SPEC-019).
 *
 * Va aparte de `construirDocumento` por la misma razón que los demás permisos:
 * ese es el camino de la importación de Excel, y un archivo sin la columna
 * borraría la marca en cada carga.
 */
/**
 * Concede o retira el permiso de revertir faltas (SPEC-032).
 *
 * Como los demás permisos, vive en el padrón y **no viaja en
 * `construirDocumento`**: si lo hiciera, una importación de Excel sin esa
 * columna lo borraría en cada carga (regla R2).
 */
/**
 * Asigna el acceso y el papel de una persona en las apps de la suite (SPEC-037).
 *
 * `cambios` trae, por app, el papel elegido o `null` para quitarle el acceso.
 * Las apps que no vienen en `cambios` no se tocan, y **las que no están en el
 * catálogo se conservan tal cual**: si mañana existe una sexta app que esta
 * pantalla todavía no conoce, guardar aquí no le borra el acceso a nadie.
 *
 * Escribe `apps` completo y solo las claves de `roles` que cambian. Como
 * `apps` y `roles`, **no viaja en `construirDocumento`** (reglas R2 y R5).
 */
export const asignarAccesos = async (
  noNomina: string,
  appsActuales: string[] | undefined,
  cambios: Record<string, string | null>,
  autor: string
) => {
  const apps = new Set(appsActuales || []);
  const campos: Record<string, unknown> = {};
  Object.entries(cambios).forEach(([app, papel]) => {
    if (papel) {
      apps.add(app);
      campos[`roles.${app}`] = papel;
    } else {
      apps.delete(app);
      // Sin acceso no tiene sentido guardar un papel: si luego se le devuelve
      // la app, entra con el que se elija entonces, no con uno viejo olvidado.
      campos[`roles.${app}`] = deleteField();
    }
  });
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    ...campos,
    apps: Array.from(apps).sort(),
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

export const asignarRevertirFaltas = async (
  noNomina: string,
  puede: boolean,
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    revertirFaltas: !!puede,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};

export const asignarVerGraficas = async (
  noNomina: string,
  puede: boolean,
  autor: string
) => {
  await updateDoc(doc(db, COLLECTION_NAME, String(noNomina).trim()), {
    verGraficas: puede,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: autor
  });
};
