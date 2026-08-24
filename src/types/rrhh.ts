export interface Colaborador {
  id?: string;
  noNomina: string;
  nombreCompleto: string;
  departamento: string;
  puesto: string;
  fechaIngreso: string;
  estatus: 'ACTIVO' | 'BAJA';
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
