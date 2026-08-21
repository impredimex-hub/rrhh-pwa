export interface Colaborador {
  id?: string;
  noNomina: string;
  nombreCompleto: string;
  departamento: string;
  puesto: string;
  fechaIngreso: string;
  fechaBaja?: string | null;
  estatus: 'ACTIVO' | 'BAJA' | 'INCAPACIDAD';
  createdAt?: any;
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

export interface Incidencia {
  id?: string;
  colaboradorId: string;
  noNomina: string;
  nombreCompleto: string;
  tipo: 'VACACIONES' | 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA' | 'INCAPACIDAD';
  fechaInicio: string;
  fechaFin: string;
  diasTotales: number;
  estatus: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
}

export interface CursoCapacitacion {
  id?: string;
  titulo: string;
  instructor: string;
  fechaInicio: string;
  fechaFin: string;
  departamentosObjetivo: string[];
  puestosObjetivo: string[];
  estatus: 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO';
}