import type { CursoCapacitacion, SesionCurso } from '../types/rrhh';

/**
 * Detección de empalmes al programar un curso (SPEC-057).
 *
 * Dos cursos el mismo día no siempre son un problema: uno a las 9:00 y otro a
 * las 14:00 conviven bien. Lo que no se puede es dar dos cursos a la misma hora.
 * Por eso hay dos resultados distintos y no uno:
 *
 * - **Choque**: se pisan en horario. Se impide registrar.
 * - **Coincidencia**: mismo día, horarios que no se tocan. Solo se avisa.
 *
 * La lógica vive aquí y no dentro del componente para poder probarla sin
 * levantar React: es la clase de regla donde un `<` en vez de un `<=` cambia el
 * resultado y nadie lo nota hasta que alguien no puede programar un curso.
 */

/** Un día concreto de un curso, ya con su horario resuelto. */
export interface DiaDeCurso {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface Empalme {
  /** El día en que se topan. `AAAA-MM-DD`. */
  fecha: string;
  /** Horario del curso que se está registrando. */
  horario: string;
  /** Título del curso que ya estaba programado. */
  titulo: string;
  /** Horario del curso que ya estaba programado. */
  horarioExistente: string;
}

export interface ResultadoEmpalmes {
  /** Se pisan en horario: no se puede registrar. */
  choques: Empalme[];
  /** Mismo día, sin pisarse: solo se advierte. */
  coincidencias: Empalme[];
}

/** `'14:30'` → 870. Devuelve `null` si no se entiende la hora. */
const aMinutos = (hora: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Cuántos días como máximo se expande un curso viejo. Ver `diasDelCurso`. */
const TOPE_DIAS_TRAMO = 60;

/** Suma un día a una fecha `AAAA-MM-DD` sin depender de la zona horaria. */
const diaSiguiente = (fecha: string): string => {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/**
 * Los días que ocupa un curso.
 *
 * Los cursos nuevos traen `sesiones` y se leen tal cual. Los anteriores a la
 * SPEC-038 no las tienen: son **un solo tramo de `fechaInicio` a `fechaFin`**,
 * así que se expanden día por día. Se expanden todos los días del tramo, no
 * solo los extremos, porque para buscar empalmes importa cada día ocupado.
 *
 * El tope de 60 días es un seguro contra un registro con una fecha mal
 * capturada —un año en vez de un día— que dejaría el ciclo corriendo.
 */
export const diasDelCurso = (curso: CursoCapacitacion): DiaDeCurso[] => {
  if (curso.sesiones && curso.sesiones.length) {
    return curso.sesiones
      .filter(s => s.fecha)
      .map(s => ({
        fecha: s.fecha,
        horaInicio: s.horaInicio || '09:00',
        horaFin: s.horaFin || '11:00'
      }));
  }

  if (!curso.fechaInicio) return [];

  const horaInicio = curso.horaInicio || '09:00';
  const horaFin = curso.horaFin || '11:00';
  const hasta = curso.fechaFin || curso.fechaInicio;

  const dias: DiaDeCurso[] = [];
  let cursor = curso.fechaInicio;
  while (cursor <= hasta && dias.length < TOPE_DIAS_TRAMO) {
    dias.push({ fecha: cursor, horaInicio, horaFin });
    cursor = diaSiguiente(cursor);
  }
  return dias;
};

/**
 * ¿Se pisan dos horarios?
 *
 * Los tramos se tratan como `[inicio, fin)`: uno que termina a las 11:00 y otro
 * que empieza a las 11:00 **no** se empalman, se dan seguidos. Es el caso más
 * común de dos cursos el mismo día y sería absurdo bloquearlo.
 *
 * Si alguna hora viene malformada se responde `true`: ante la duda, que avise.
 */
export const seEmpalman = (a: DiaDeCurso, b: DiaDeCurso): boolean => {
  const aIni = aMinutos(a.horaInicio);
  const aFin = aMinutos(a.horaFin);
  const bIni = aMinutos(b.horaInicio);
  const bFin = aMinutos(b.horaFin);

  if (aIni === null || aFin === null || bIni === null || bFin === null) return true;

  return aIni < bFin && bIni < aFin;
};

const horarioDe = (d: DiaDeCurso) => `${d.horaInicio} - ${d.horaFin}`;

/**
 * Compara los días de un curso contra los cursos ya programados.
 *
 * `idExcluido` es el curso que se está editando: sin él, todo curso chocaría
 * consigo mismo en cuanto alguien le corrigiera el instructor.
 */
export const buscarEmpalmes = (
  sesiones: SesionCurso[],
  cursosExistentes: CursoCapacitacion[],
  idExcluido?: string
): ResultadoEmpalmes => {
  const choques: Empalme[] = [];
  const coincidencias: Empalme[] = [];

  const nuevos: DiaDeCurso[] = sesiones
    .filter(s => s.fecha)
    .map(s => ({
      fecha: s.fecha,
      horaInicio: s.horaInicio || '09:00',
      horaFin: s.horaFin || '11:00'
    }));

  for (const curso of cursosExistentes) {
    if (idExcluido && curso.id === idExcluido) continue;

    const diasExistentes = diasDelCurso(curso);

    for (const nuevo of nuevos) {
      for (const viejo of diasExistentes) {
        if (nuevo.fecha !== viejo.fecha) continue;

        const dato: Empalme = {
          fecha: nuevo.fecha,
          horario: horarioDe(nuevo),
          titulo: curso.titulo || '(sin título)',
          horarioExistente: horarioDe(viejo)
        };

        if (seEmpalman(nuevo, viejo)) choques.push(dato);
        else coincidencias.push(dato);
      }
    }
  }

  return { choques, coincidencias };
};
