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
   * Opcional a propósito: al importar desde Excel se omite para que el
   * documento conserve el estatus que ya tenía y una baja no reviva sola.
   */
  estatus?: 'ACTIVO' | 'BAJA';
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

/** Catálogo de turnos. Es el mismo de la app de Mantenimiento, a propósito. */
export type ClaveTurno = 'T1' | 'T2' | 'T3' | 'D12' | 'N12' | 'G8' | 'LIB';

export const HORARIO_TURNO: Record<ClaveTurno, string> = {
  T1: '06:00 – 14:00',
  T2: '14:00 – 21:30',
  T3: '21:30 – 06:00',
  D12: '06:00 – 18:00',
  N12: '18:00 – 06:00',
  G8: '08:00 – 18:00',
  LIB: 'Horario libre'
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
