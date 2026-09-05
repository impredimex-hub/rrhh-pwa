import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * Proyecto compartido de la suite Impredimex: autenticación y lista de personal.
 *
 * Se inicializa **con nombre** ('suite') porque la aplicación ya tiene su propio
 * proyecto de Firebase para sus datos. Sin el nombre las dos configuraciones se
 * pisan.
 *
 * La configuración de un cliente web de Firebase no es secreta: va en el código
 * a propósito. Lo que protege el acceso son las reglas, no ocultar esto.
 */
const SUITE_CONFIG = {
  apiKey: 'AIzaSyBAfEAWPYCdt_7kN1uHqTmPiRHIn6BgOyo',
  authDomain: 'impredimex-suite.firebaseapp.com',
  projectId: 'impredimex-suite',
  storageBucket: 'impredimex-suite.firebasestorage.app',
  messagingSenderId: '272151508788',
  appId: '1:272151508788:web:df68c90faa8cc1996cd761'
};

/** Identificador de esta app dentro del campo `apps` de cada colaborador. */
export const APP_ID = 'rrhh';

/**
 * No existe como dominio real. Solo arma un identificador único para Firebase
 * Auth, que no envía correos ni lo verifica.
 */
const DOMINIO = '@impredimex.local';

const suiteApp = getApps().some(a => a.name === 'suite')
  ? getApp('suite')
  : initializeApp(SUITE_CONFIG, 'suite');

export const suiteAuth = getAuth(suiteApp);
export const suiteDb = getFirestore(suiteApp);

// La sesión sobrevive al recargar y al cerrar el navegador. Salir es un acto
// explícito.
setPersistence(suiteAuth, browserLocalPersistence).catch(e =>
  console.error('No se pudo fijar la persistencia de la sesión', e)
);

export type PapelRRHH = 'ADMIN' | 'CAPTURA' | 'CONSULTA';

export interface Sesion {
  nomina: string;
  nombre: string;
  departamento: string;
  papel: PapelRRHH;
}

/** Error de acceso ya traducido a algo que una persona entiende. */
export class ErrorDeAcceso extends Error {}

export function mensajeDeError(codigo: string): string {
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Nómina o clave incorrecta.';
    case 'auth/invalid-email':
      return 'Ese número de nómina no tiene un formato válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu red e inténtalo otra vez.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}

export async function entrar(nomina: string, clave: string): Promise<void> {
  await signInWithEmailAndPassword(suiteAuth, nomina.trim() + DOMINIO, clave);
}

export async function salir(): Promise<void> {
  await signOut(suiteAuth);
}

/**
 * Construye la sesión a partir del usuario autenticado.
 *
 * Tener cuenta no da acceso: lo da estar en `apps`. Y la ausencia de papel
 * equivale al más bajo, nunca se concede privilegio por omisión.
 */
export async function armarSesion(user: User): Promise<Sesion> {
  const nomina = (user.email || '').split('@')[0];

  let snap;
  try {
    snap = await getDoc(doc(suiteDb, 'colaboradores', nomina));
  } catch {
    throw new ErrorDeAcceso('No se pudo leer tu registro de personal. Revisa tu conexión.');
  }

  if (!snap.exists()) {
    throw new ErrorDeAcceso('Tu cuenta no tiene registro de personal. Avisa a Recursos Humanos.');
  }

  const c = snap.data() as Record<string, unknown>;

  if (c.estatus !== 'ACTIVO') {
    throw new ErrorDeAcceso('Esta cuenta está dada de baja.');
  }

  const apps = Array.isArray(c.apps) ? (c.apps as string[]) : [];
  if (!apps.includes(APP_ID)) {
    throw new ErrorDeAcceso('Tu cuenta no tiene acceso a Recursos Humanos.');
  }

  const roles = (c.roles || {}) as Record<string, string>;
  const declarado = roles[APP_ID];
  const papel: PapelRRHH =
    declarado === 'ADMIN' || declarado === 'CAPTURA' ? declarado : 'CONSULTA';

  return {
    nomina,
    nombre: (c.nombreCompleto as string) || nomina,
    departamento: (c.departamento as string) || '',
    papel
  };
}

export function vigilarSesion(cb: (user: User | null) => void) {
  return onAuthStateChanged(suiteAuth, cb);
}
