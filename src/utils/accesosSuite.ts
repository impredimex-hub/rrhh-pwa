/**
 * Las aplicaciones de la suite y los papeles que acepta cada una (SPEC-037).
 *
 * Es la única fuente de estos valores. Cada app tiene su propio vocabulario, y
 * **escribirlo distinto la deja sin reconocer el papel**: Mantenimiento usa
 * minúsculas (`admin`) y las demás mayúsculas (`ADMIN`). Hasta ahora esto se
 * cambiaba a mano en la consola de Firebase, y un `ADMIN` en la clave `manto`
 * hacía que esa persona entrara mal. Aquí el valor se elige de una lista, así
 * que no hay forma de escribirlo mal.
 *
 * Si una app agrega un papel, se agrega aquí y en esa app, en ese orden.
 *
 * `porOmision` es con qué papel entra alguien que tiene la app en `apps` pero
 * no tiene clave en `roles`. Se muestra para no sorprender a nadie: no es un
 * valor que se guarde.
 */
export interface PapelApp {
  valor: string;
  etiqueta: string;
}

export interface AppSuite {
  id: string;
  nombre: string;
  papeles: PapelApp[];
  porOmision: string;
}

export const APPS_SUITE: AppSuite[] = [
  {
    id: 'rrhh',
    nombre: 'Recursos Humanos',
    papeles: [
      { valor: 'ADMIN', etiqueta: 'Administrador' },
      { valor: 'CAPTURA', etiqueta: 'Captura' },
      { valor: 'CONSULTA', etiqueta: 'Consulta' }
    ],
    porOmision: 'CONSULTA'
  },
  {
    id: 'epp',
    nombre: 'EPP',
    papeles: [
      { valor: 'ADMIN', etiqueta: 'Administrador' },
      { valor: 'SUPERVISOR', etiqueta: 'Supervisor' }
    ],
    porOmision: 'SUPERVISOR'
  },
  {
    id: 'procesos',
    nombre: 'Ingeniería de Procesos',
    papeles: [
      { valor: 'ADMIN', etiqueta: 'Administrador' },
      { valor: 'SUPERVISOR', etiqueta: 'Supervisor' }
    ],
    porOmision: 'SUPERVISOR'
  },
  {
    id: 'calidad',
    nombre: 'Control de Procesos',
    papeles: [
      { valor: 'ADMIN', etiqueta: 'Administrador' },
      { valor: 'SUPERVISOR', etiqueta: 'Supervisor' },
      { valor: 'INSPECTOR', etiqueta: 'Inspector' }
    ],
    porOmision: 'INSPECTOR'
  },
  {
    id: 'manto',
    nombre: 'Mantenimiento',
    // En minúsculas a propósito: así las compara Mantenimiento.
    papeles: [
      { valor: 'admin', etiqueta: 'Administrador' },
      { valor: 'supervisor', etiqueta: 'Supervisor' },
      { valor: 'tecnico', etiqueta: 'Técnico' },
      { valor: 'solicitante', etiqueta: 'Solicitante' }
    ],
    porOmision: 'solicitante'
  }
];

export interface EstadoAcceso {
  /** Tiene la app en `apps`. Es lo único que da acceso. */
  tiene: boolean;
  /** Lo que dice `roles[app]`, tal cual. */
  declarado?: string;
  /** El papel escrito es uno que la app reconoce. */
  reconocido: boolean;
}

/**
 * Cómo está hoy una persona en una app.
 *
 * Un papel mal escrito —`ADMIN` en mayúsculas en Mantenimiento, por ejemplo—
 * no se disimula: se marca como no reconocido para que se corrija. Cada app lo
 * trata distinto (RRHH lo baja a CONSULTA, Mantenimiento entra sin reconocer
 * ninguna pantalla), así que no hay un «papel efectivo» honesto que mostrar.
 */
export const leerAcceso = (
  app: AppSuite,
  apps: string[] | undefined,
  roles: Record<string, string> | undefined
): EstadoAcceso => {
  const tiene = (apps || []).includes(app.id);
  const declarado = (roles || {})[app.id];
  const reconocido = declarado === undefined || app.papeles.some(p => p.valor === declarado);
  return { tiene, declarado, reconocido };
};
