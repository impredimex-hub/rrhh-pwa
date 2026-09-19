export interface Colaborador {
  id?: string;
  noNomina: string;
  nombreCompleto: string;
  /**
   * Nombre sin acentos y en mayúsculas. Lo usan las otras apps de la suite
   * para buscar. Se recalcula al guardar; si queda viejo, esas búsquedas dejan
   * de encontrar a la persona sin dar ningún error.
   */
  nombreNormalizado?: string;
  departamento: string;
  puesto: string;
  fechaIngreso: string;
  /**
   * Fecha de nacimiento, `AAAA-MM-DD`. Solo se usan el día y el mes para la
   * lista de cumpleaños; el año se guarda porque sirve para la edad, pero se
   * omite si no es creíble (ver `edadQueCumple`).
   *
   * Se escribe de forma condicional en `construirDocumento`: un Excel del
   * directorio sin esta columna no debe borrar los cumpleaños ya cargados.
   */
  fechaNacimiento?: string;
  /**
   * Departamentos cuyos roles de turnos puede crear y editar esta persona
   * (SPEC-013). Vacío o ausente significa que solo consulta. No lo escribe la
   * importación de Excel ni la edición normal del padrón: solo la pantalla de
   * permisos, para que un archivo mal armado no borre permisos en silencio.
   */
  departamentosTurnos?: string[];
  /**
   * Puede sacar el reporte de faltas de **todas** las áreas de una sola vez
   * (SPEC-015). Es para quien lo necesita por función, como Recursos Humanos,
   * sin tener que ser administrador de la aplicación. Un `ADMIN` lo puede
   * siempre, sin necesidad de traer esta marca.
   */
  reporteFaltasTodas?: boolean;
  /**
   * Puede capturar y dar seguimiento a las promociones internas (SPEC-016).
   * Es para Recursos Humanos, sin necesidad de ser administrador. Un `ADMIN`
   * lo puede siempre, sin traer esta marca.
   */
  capturaPromociones?: boolean;
  /**
   * Puede ver las gráficas de la aplicación (SPEC-019). Se reservan porque
   * concentran información de toda la plantilla —rotación, faltas por área,
   * incidencias por departamento— que no le toca a cualquiera que entre a
   * consultar su propio turno. Un `ADMIN` las ve siempre, sin traer esta marca.
   */
  verGraficas?: boolean;
  /**
   * Puede revertir una falta y darla por asistencia (SPEC-032).
   *
   * **Este permiso no lo implica ser ADMIN**, a diferencia de los demás: se
   * pidió expresamente que lo tuviera una sola persona. Como todos, vive en el
   * padrón y no viaja en `construirDocumento` (reglas R1 y R2).
   */
  revertirFaltas?: boolean;
  /**
   * Opcional a propósito: al importar desde Excel se omite para que el
   * documento conserve el estatus que ya tenía y una baja no reviva sola.
   */
  estatus?: 'ACTIVO' | 'BAJA';
  /**
   * Día en que se marcó la baja, `AAAA-MM-DD`. Lo escribe `cambiarEstatus` y
   * nadie más; la importación de Excel no lo toca.
   *
   * Hace falta porque `actualizadoEn` no sirve para medir rotación: cambia con
   * cualquier edición del registro, así que una baja de hace un año parecería
   * de ayer en cuanto alguien le corrija el puesto. Las bajas anteriores a este
   * campo no lo traen y quedan fuera de la gráfica.
   */
  fechaBaja?: string;
  /**
   * Heredados de una versión anterior. La antigüedad se calcula al vuelo desde
   * `fechaIngreso`; guardarla la deja desactualizada cada mes.
   * @deprecated
   */
  antiguedadAnios?: number;
  antiguedadMeses?: number;
}

export interface Vacante {
  id?: string;
  puesto: string;
  departamento: string;
  cantidadRequerida: number;
  cantidadCubierta: number;
  estatus: 'ABIERTA' | 'EN_PROCESO' | 'CUBIERTA';
  fechaCreacion: string;
}

export type TipoIncidencia =
  | 'FALTA_INJUSTIFICADA'
  | 'RETARDO'
  | 'INCIDENCIA_RIT'
  | 'INCAPACIDAD'
  | 'INCUMPLIMIENTO_BPM'
  | 'INCUMPLIMIENTO_EPP'
  | 'INCUMPLIMIENTO_PROCESO'
  | 'INCUMPLIMIENTO_AUDITORIA';

/** Etiqueta legible de cada tipo. Se usa en el formulario, en la tabla y en
 *  las exportaciones, para que digan lo mismo en los tres lados. */
export const ETIQUETA_INCIDENCIA: Record<TipoIncidencia, string> = {
  FALTA_INJUSTIFICADA:      'Falta injustificada',
  RETARDO:                  'Retardo',
  INCIDENCIA_RIT:           'Incidencia RIT',
  INCAPACIDAD:              'Incapacidad',
  INCUMPLIMIENTO_BPM:       'Incumplimiento de BPM',
  INCUMPLIMIENTO_EPP:       'Incumplimiento de EPP',
  INCUMPLIMIENTO_PROCESO:   'Incumplimiento de proceso',
  INCUMPLIMIENTO_AUDITORIA: 'Incumplimiento de auditoría'
};

/** v2.1: se retiran fechaInicio/fechaFin/diasTotales/estatus (el estatus nunca
 *  tuvo más de un valor posible, "APROBADO"; no era un flujo real). En su
 *  lugar, observaciones libres y una suspensión explícita: si `suspension` es
 *  verdadero, `fechasSuspension` guarda los días exactos elegidos en el
 *  calendario y su longitud siempre coincide con `diasSuspension`. */
export interface Incidencia {
  id?: string;
  /**
   * Día en que se levanta la incidencia, `AAAA-MM-DD` (SPEC-020).
   *
   * Es dato capturado, no el momento del guardado: una incidencia puede
   * registrarse días después de ocurrida. Las incidencias anteriores a este
   * campo no lo traen y se muestran con un guion.
   */
  fecha?: string;
  colaboradorId: string;
  noNomina: string;
  nombreCompleto: string;
  tipo: TipoIncidencia;
  observaciones?: string;
  suspension: boolean;
  diasSuspension?: number;      // solo cuando suspension = true
  fechasSuspension?: string[];  // 'YYYY-MM-DD'; longitud == diasSuspension
}

export interface CursoCapacitacion {
  id?: string;
  titulo: string;
  instructor?: string;
  departamentosObjetivo: string[];
  puestosObjetivo?: string[];
  fechaInicio: string;
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
  estatus: 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO';
}

/**
 * Constancia de que una persona cursó un curso (SPEC-028).
 *
 * Vive dentro del documento del curso en `cursosCompletados`, bajo la clave de
 * su nómina; no es un documento propio. La calificación es opcional porque no
 * todos los cursos llevan examen.
 */
/**
 * Una falta revertida a mano (SPEC-032).
 *
 * La asistencia se infiere de la revisión de EPP: si no hubo revisión, la
 * persona aparece ausente aunque haya venido. Esto es la excepción, y por eso
 * guarda motivo y firma de quién la hizo.
 */
export interface AsistenciaManual {
  noNomina: string;
  /** `AAAA-MM-DD`. */
  fecha: string;
  nombreCompleto?: string;
  departamento?: string;
  motivo: string;
  porNomina: string;
  porNombre: string;
  creadoEn?: number;
}

export interface RegistroCursoCompletado {
  /** Día en que se marcó como cursado, `AAAA-MM-DD`. */
  fecha: string;
  calificacion?: number;
  porNomina?: string;
  porNombre?: string;
}

/* ───────────────── Sucesos y rol de turnos (v2.4) ───────────────── */

export type TipoSuceso =
  | 'NO_SE_PRESENTO'
  | 'ABANDONO_TURNO'
  | 'LLEGADA_TARDE'
  | 'CAMBIO_DE_TURNO'
  | 'ACCIDENTE'
  | 'OTRO';

export const ETIQUETA_SUCESO: Record<TipoSuceso, string> = {
  NO_SE_PRESENTO: 'No se presentó a laborar',
  ABANDONO_TURNO: 'Abandonó el turno',
  LLEGADA_TARDE: 'Llegada tarde',
  CAMBIO_DE_TURNO: 'Cambio de turno',
  ACCIDENTE: 'Accidente o incidente',
  OTRO: 'Otro'
};

/**
 * Un suceso es un reporte de piso: lo levanta quien está en el turno, sea o no
 * administrador. No es una incidencia: no afecta nómina ni suspensiones, es
 * solo la bitácora de lo que pasó.
 */
export interface Suceso {
  id?: string;
  fecha: string;            // 'YYYY-MM-DD'
  noNomina: string;
  nombreCompleto: string;
  departamento: string;
  tipo: TipoSuceso;
  descripcion?: string;
  /** Nómina y nombre de quien levantó el reporte, copiados al guardar. */
  reportadoPorNomina: string;
  reportadoPorNombre: string;
}

/**
 * Catálogo de turnos. Es el mismo de la app de Mantenimiento, a propósito.
 *
 * `G8` se renombró a `ADM` en la versión 2.16.0 (SPEC-027), pero **sigue aquí**:
 * los roles ya guardados tienen celdas con `G8` escrito dentro, y quitarlo las
 * dejaría sin horario y sin hora de fin, lo que además haría que esas jornadas
 * nunca contaran como falta. `ADM` es la clave que se ofrece de aquí en
 * adelante; `G8` solo se lee, y se muestra como `ADM`.
 */
export type ClaveTurno = 'T1' | 'T2' | 'T3' | 'D12' | 'N12' | 'ADM' | 'G8' | 'LIB';

export const HORARIO_TURNO: Record<ClaveTurno, string> = {
  T1: '06:00 – 14:00',
  T2: '14:00 – 21:30',
  T3: '21:30 – 06:00',
  D12: '06:00 – 18:00',
  N12: '18:00 – 06:00',
  ADM: '08:00 – 18:00',
  G8: '08:00 – 18:00',
  LIB: 'Horario libre'
};

/** Cómo se muestra una clave guardada. `G8` es el nombre viejo de `ADM`. */
export const etiquetaTurno = (clave: ClaveTurno): string => (clave === 'G8' ? 'ADM' : clave);

/**
 * Hora de salida de cada turno, en minutos desde la medianoche del día del rol.
 * Los que pasan de 1440 terminan al día siguiente: un T3 del día 14 acaba a
 * las 06:00 del 15, y hasta ese momento no se puede juzgar su asistencia.
 */
export const FIN_TURNO: Record<Exclude<ClaveTurno, 'LIB'>, number> = {
  T1:  14 * 60,            // 14:00 del mismo día
  T2:  21 * 60 + 30,       // 21:30 del mismo día
  T3:  24 * 60 + 6 * 60,   // 06:00 del día siguiente
  D12: 18 * 60,            // 18:00 del mismo día
  N12: 24 * 60 + 6 * 60,   // 06:00 del día siguiente
  ADM: 18 * 60,            // 18:00 del mismo día
  G8:  18 * 60             // clave heredada, mismo horario que ADM
};

export type PeriodoRol = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

/**
 * Una asignación es un turno en un día concreto. Con `LIB` las horas las
 * captura la persona a mano, por eso viajan con la asignación.
 */
export interface AsignacionTurno {
  turno: ClaveTurno;
  horaInicio?: string;  // solo con LIB
  horaFin?: string;     // solo con LIB
}

export interface RolTurnos {
  id?: string;
  nombre: string;
  departamento: string;
  periodo: PeriodoRol;
  fechaInicio: string;      // 'YYYY-MM-DD'
  /**
   * Clave `${noNomina}|${fechaISO}` → asignación. Se guarda plano y no
   * anidado porque Firestore no admite puntos ni barras en los nombres de
   * campo, y una fecha los trae.
   */
  asignaciones: Record<string, AsignacionTurno>;
  /** Quién lo creó: solo esa persona o un ADMIN pueden editarlo o borrarlo. */
  creadoPorNomina: string;
  creadoPorNombre: string;
}

/* ───────────────── Promociones internas (v2.9) ───────────────── */

export type TipoPromocion = 'PLANTA' | 'CATEGORIA' | 'PUESTO';

export const ETIQUETA_PROMOCION: Record<TipoPromocion, string> = {
  PLANTA: 'Contrato de planta',
  CATEGORIA: 'Nueva categoría en su puesto',
  PUESTO: 'Cambio de puesto'
};

export type EstatusPromocion = 'EN_PROCESO' | 'APROBADA' | 'RECHAZADA';

export const ETIQUETA_ESTATUS_PROMOCION: Record<EstatusPromocion, string> = {
  EN_PROCESO: 'En proceso',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada'
};

/**
 * Evaluación para contrato de planta o promoción interna.
 *
 * Son tres meses con una evaluación mensual. Las calificaciones viven en
 * `calificaciones`, con clave '1', '2' y '3': se guarda solo el mes que ya se
 * evaluó, en vez de tres campos que empezarían vacíos, porque Firestore
 * rechaza un documento con cualquier campo en `undefined`.
 */
export interface PromocionInterna {
  id?: string;
  noNomina: string;
  nombreCompleto: string;
  departamento: string;
  /** Puesto al momento de abrir la evaluación, copiado para que el histórico
   *  no cambie si después se corrige el padrón. */
  puestoActual: string;
  tipo: TipoPromocion;
  /** Categoría o puesto de destino. En un contrato de planta no aplica. */
  destino?: string;
  /** Inicio del periodo de tres meses, 'YYYY-MM-DD'. */
  fechaInicio: string;
  calificaciones: Record<string, number>;
  estatus: EstatusPromocion;
  observaciones?: string;
  /**
   * Rondas cerradas antes de la actual (SPEC-021).
   *
   * Cuando una evaluación se rechaza y se decide darle tres meses más, la ronda
   * que terminó se guarda aquí antes de limpiar las calificaciones. Perderlas
   * en silencio borraría la única evidencia de por qué se le dio otra
   * oportunidad a alguien.
   */
  rondasPrevias?: {
    fechaInicio: string;
    calificaciones: Record<string, number>;
    cerradaEl: string;
    cerradaPor?: string;
  }[];
  creadoPorNomina: string;
  creadoPorNombre: string;
}

/** Escala de las calificaciones mensuales. */
export const CALIFICACION_MIN = 0;
export const CALIFICACION_MAX = 100;
