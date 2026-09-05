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

export type TipoIncidencia = 'FALTA_INJUSTIFICADA' | 'INCIDENCIA_RIT' | 'INCAPACIDAD';

export interface Incidencia {
  id?: string;
  colaboradorId: string;
  noNomina: string;
  nombreCompleto: string;
  tipo: TipoIncidencia;
  fechaInicio: string;
  fechaFin: string;
  diasTotales: number;
  motivo?: string;
  estatus: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
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
