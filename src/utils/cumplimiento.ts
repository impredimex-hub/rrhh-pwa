/**
 * Cumplimiento de las actividades de supervisión (SPEC-060).
 *
 * Funciones puras: reciben lo ya leído de Firestore y devuelven quién falló
 * qué y cuándo. Sin metas ni porcentajes: el panel solo observa.
 *
 * Fechas siempre como 'AAAA-MM-DD' en hora local, comparables como texto.
 */

const pad = (n: number) => String(n).padStart(2, '0');
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };

/** Días de `desde` a `hasta`, ambos incluidos. */
export const diasEntre = (desde: string, hasta: string): string[] => {
  if (!desde || !hasta || desde > hasta) return [];
  const out: string[] = [];
  const f = aFecha(desde);
  for (let i = 0; i < 400; i++) {
    const d = new Date(f.getFullYear(), f.getMonth(), f.getDate() + i);
    const s = isoLocal(d);
    if (s > hasta) break;
    out.push(s);
  }
  return out;
};

/** Lunes de la semana de `hoy` (la semana de planta empieza en lunes). */
export const lunesDe = (hoy: Date): string => {
  const dow = hoy.getDay();                 // 0 = domingo
  const atras = dow === 0 ? 6 : dow - 1;
  return isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - atras));
};

/** Sin acentos y en mayúsculas, para comparar nombres de departamento. */
export const normalizar = (s: string) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/* ═════════════════════════ Control de EPP ═════════════════════════ */

/**
 * El reporte diario de EPP es obligatorio de lunes a sábado; el domingo no.
 */
export const diaObligatorioEPP = (fecha: string) => aFecha(fecha).getDay() !== 0;

/**
 * Cuándo deja de poder hacerse el reporte de un día.
 *
 * EPP fecha el reporte con el «día de turno», que va de 06:00 a 06:00: lo que
 * se reporta el martes a las 03:00 cuenta para el lunes. Así que un día entre
 * semana cierra a las 06:00 del día siguiente. El sábado la planta para a las
 * 21:30, y el reporte se exige hasta esa hora.
 */
export const cierreDelDia = (fecha: string): Date => {
  const d = aFecha(fecha);
  if (d.getDay() === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 30);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 6, 0);
};

/** Lo que EPP dejó escrito en `faltas/<fecha>`, reducido a lo que importa aquí. */
export interface ControlDelDia {
  /** Nómina → nombre de quien reportó ese día (una falta o «sin faltas»). */
  porNomina: Record<string, string>;
  /** Área → quién dejó la constancia «sin faltas» de esa área. */
  sinFaltasPorArea: Record<string, { nomina: string; nombre: string }>;
}

export interface ObligadoEPP {
  nomina: string;
  nombre: string;
  areas: string[];
}

export interface FallaEPP {
  fecha: string;
  /**
   * Si alguien más dejó constancia de una de sus áreas ese día. EPP guarda
   * «sin faltas» por área y no por persona, así que cuando dos supervisores
   * comparten un área el segundo borra la constancia del primero. En ese caso
   * no se puede afirmar que esta persona no revisó: se muestra aparte, como
   * «el área la revisó X», y no como falla.
   */
  cubiertaPor?: string;
}

export interface ResultadoEPP extends ObligadoEPP {
  fallas: FallaEPP[];      // días cerrados sin reporte propio ni de su área
  cubiertas: FallaEPP[];   // días sin registro propio, pero su área sí se revisó
  pendientes: string[];    // días que todavía no cierran
  hechos: number;
}

export const cumplimientoEPP = (
  obligados: ObligadoEPP[],
  controles: Record<string, ControlDelDia>,
  desde: string,
  hasta: string,
  ahora: Date = new Date()
): ResultadoEPP[] => {
  const dias = diasEntre(desde, hasta).filter(diaObligatorioEPP);
  return obligados.map(o => {
    const r: ResultadoEPP = { ...o, fallas: [], cubiertas: [], pendientes: [], hechos: 0 };
    dias.forEach(f => {
      const c = controles[f];
      if (c && c.porNomina[o.nomina]) { r.hechos++; return; }
      if (ahora < cierreDelDia(f)) { r.pendientes.push(f); return; }
      const otro = c && o.areas
        .map(a => c.sinFaltasPorArea[a])
        .find(x => x && x.nomina !== o.nomina);
      if (otro) r.cubiertas.push({ fecha: f, cubiertaPor: otro.nombre || otro.nomina });
      else r.fallas.push({ fecha: f });
    });
    return r;
  });
};

/* ═════════════════════════ Rol de turnos ═════════════════════════ */

/**
 * Departamentos que deben llevar rol de turnos. Se comparan sin acentos
 * contra los nombres reales del padrón; los alias cubren cómo los llama la
 * gente («Impresión flexo» es FLEXOGRAFÍA, «Roto» es ROTOGRABADO).
 */
export const DEPARTAMENTOS_CON_ROL: { nombre: string; alias: string[] }[] = [
  { nombre: 'CALIDAD', alias: ['CALIDAD'] },
  { nombre: 'MANTENIMIENTO', alias: ['MANTENIMIENTO'] },
  { nombre: 'FLEXOGRAFÍA', alias: ['FLEXOGRAFIA', 'FLEXO', 'IMPRESION FLEXO'] },
  { nombre: 'ROTOGRABADO', alias: ['ROTOGRABADO', 'ROTO', 'IMPRESION ROTO'] },
  { nombre: 'DIGITAL', alias: ['DIGITAL', 'IMPRESION DIGITAL'] },
  { nombre: 'ACONDICIONADO', alias: ['ACONDICIONADO'] },
  { nombre: 'LOGÍSTICA', alias: ['LOGISTICA'] },
  { nombre: 'TINTAS', alias: ['TINTAS'] }
];

/**
 * Cruza la lista contra los departamentos que existen en el padrón. Devuelve
 * el nombre tal como está en el padrón (es el que usan los roles) y los que
 * no se encontraron, para avisarlo en vez de callarlo.
 */
export const departamentosConRol = (existentes: string[]) => {
  const porNorm = new Map(existentes.map(d => [normalizar(d), d]));
  const encontrados: string[] = [];
  const faltantes: string[] = [];
  DEPARTAMENTOS_CON_ROL.forEach(({ nombre, alias }) => {
    const real = alias.map(a => porNorm.get(a)).find(Boolean);
    if (real) encontrados.push(real); else faltantes.push(nombre);
  });
  return { encontrados, faltantes };
};

/** Lo mínimo de un rol para juzgarlo; sale del rol vivo o de su ficha de historial. */
export interface RolResumen {
  id: string;
  nombre: string;
  departamento: string;
  fechaInicio: string;
  fechaFin: string;
  creadoPorNombre: string;
  /** Milisegundos de cuando se subió por primera vez. null = sin dato. */
  subidoEn: number | null;
}

export interface ResultadoRol {
  departamento: string;
  responsables: string[];
  /** Días ya iniciados del periodo que ningún rol cubre. */
  sinRol: string[];
  /** Días futuros del periodo que todavía no tienen rol. */
  porProgramar: string[];
  /** Roles subidos después de que empezó su periodo. */
  tarde: { nombre: string; fechaInicio: string; subidoEn: number; creadoPorNombre: string }[];
}

export const cumplimientoRoles = (
  departamentos: string[],
  roles: RolResumen[],
  responsables: Record<string, string[]>,
  desde: string,
  hasta: string,
  ahora: Date = new Date()
): ResultadoRol[] => {
  const hoy = isoLocal(ahora);
  const dias = diasEntre(desde, hasta);
  return departamentos.map(depto => {
    const n = normalizar(depto);
    const suyos = roles.filter(r => normalizar(r.departamento) === n);
    const cubre = (f: string) => suyos.some(r => r.fechaInicio <= f && f <= r.fechaFin);
    const sin = dias.filter(f => !cubre(f));
    const tarde = suyos
      .filter(r => r.fechaInicio <= hasta && r.fechaFin >= desde)
      .filter(r => r.subidoEn !== null && r.subidoEn > aFecha(r.fechaInicio).getTime())
      .map(r => ({ nombre: r.nombre, fechaInicio: r.fechaInicio, subidoEn: r.subidoEn as number, creadoPorNombre: r.creadoPorNombre }));
    return {
      departamento: depto,
      responsables: responsables[depto] || [],
      sinRol: sin.filter(f => f <= hoy),
      porProgramar: sin.filter(f => f > hoy),
      tarde
    };
  });
};

/** Agrupa días consecutivos: ['05','06','07','09'] → '05/10–07/10, 09/10'. */
export const rangosLegibles = (dias: string[]): string => {
  if (!dias.length) return '';
  const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  const orden = [...dias].sort();
  const tramos: string[][] = [];
  orden.forEach(f => {
    const ult = tramos[tramos.length - 1];
    if (ult) {
      const prev = aFecha(ult[ult.length - 1]);
      const sig = isoLocal(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
      if (sig === f) { ult.push(f); return; }
    }
    tramos.push([f]);
  });
  return tramos.map(t => t.length === 1 ? dm(t[0]) : `${dm(t[0])}–${dm(t[t.length - 1])}`).join(', ');
};
