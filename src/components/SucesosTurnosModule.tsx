import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, FileSpreadsheet, FileText, Edit2, Copy, ClipboardPaste, Eraser, X, ChevronLeft, ShieldCheck, Eye, Check, FileWarning } from 'lucide-react';
import type {
  Colaborador, Suceso, TipoSuceso, RolTurnos, PeriodoRol, ClaveTurno, AsignacionTurno
} from '../types/rrhh';
import { ETIQUETA_SUCESO, HORARIO_TURNO } from '../types/rrhh';
import { subscribeColaboradores, asignarDepartamentosTurnos, asignarReporteFaltasTodas, asignarCapturaPromociones } from '../services/personalService';
import { subscribeSucesos, saveSuceso, deleteSuceso } from '../services/sucesoService';
import { subscribeRolesTurnos, saveRolTurnos, deleteRolTurnos, diasDelPeriodo, claveCelda, turnoYaTermino } from '../services/turnoService';
import { subscribeAsistenciasRango, obtenerAsistenciasRango } from '../services/asistenciaService';
import { usePermisos, useSesion } from '../services/SesionContext';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { BarrasVerticales, BarrasHorizontales, COLORES } from './Graficas';

const CLAVES_TURNO: ClaveTurno[] = ['T1', 'T2', 'T3', 'D12', 'N12', 'G8', 'LIB'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const hoyISO = () => new Date().toISOString().split('T')[0];

/** Fecha ISO a Date local, sin pasar por UTC (que recorrería un día). */
const desdeISO = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

const etiquetaDia = (iso: string) => {
  const f = desdeISO(iso);
  return { dow: DIAS_CORTOS[f.getDay()], num: f.getDate(), esDomingo: f.getDay() === 0 };
};

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

const SUB = { fontSize: '10px', fontWeight: 'bold' as const, color: 'var(--brand-navy)' };

/**
 * Los tres botones de la cabecera del rol de turnos. Un solo objeto para que
 * midan exactamente igual: al ser redondos y sin texto, cualquier diferencia
 * de tamaño se nota de inmediato.
 *
 * Sin etiqueta visible, el `title` y el `aria-label` de cada uno son lo único
 * que dice qué hacen; por eso van siempre.
 */
const BOTON_REDONDO: React.CSSProperties = {
  width: '34px',
  height: '34px',
  flexShrink: 0,
  borderRadius: '50%',
  border: '1px solid rgba(0,32,96,.15)',
  background: '#fff',
  color: 'var(--brand-navy)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit'
};

export const SucesosTurnosModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [sucesos, setSucesos] = useState<Suceso[]>([]);
  const [roles, setRoles] = useState<RolTurnos[]>([]);

  const sesion = useSesion();
  const { papel } = usePermisos();
  const esAdmin = papel === 'ADMIN';

  useEffect(() => {
    const u1 = subscribeColaboradores(setColaboradores);
    const u2 = subscribeSucesos(setSucesos);
    const u3 = subscribeRolesTurnos(setRoles);
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Gráfica de faltas (SPEC-018) ───────────────────────────────────────
  // Va bajo demanda y no al abrir la pestaña: calcularla exige leer las
  // asistencias de EPP del periodo, que son un documento por persona y día.
  // Hacerlo en cada visita gastaría cuota de Firestore sin que nadie lo pida.
  const [grafDias, setGrafDias] = useState(14);
  const [grafCargando, setGrafCargando] = useState(false);
  const [grafError, setGrafError] = useState('');
  const [grafFaltas, setGrafFaltas] = useState<null | { fecha: string; depto: string }[]>(null);

  const activos = useMemo(
    () => colaboradores.filter(c => c.estatus !== 'BAJA'),
    [colaboradores]
  );

  const departamentos = useMemo(
    () => Array.from(new Set(activos.map(c => (c.departamento || '').trim().toUpperCase()).filter(Boolean))).sort(),
    [activos]
  );

  /** Solo quien lo creó, o un administrador, puede tocar un rol. */
  /**
   * Departamentos que esta sesión puede programar. Un ADMIN los puede todos;
   * el resto, solo los que tenga asignados en el padrón. Sin asignación, la
   * lista queda vacía y esa persona únicamente consulta.
   */
  const misDepartamentos = useMemo(() => {
    if (esAdmin) return departamentos;
    if (!sesion) return [];
    const yo = colaboradores.find(c => c.noNomina === sesion.nomina);
    const asignados = (yo?.departamentosTurnos || []).map(d => d.trim().toUpperCase());
    // Se cruza contra los departamentos que existen hoy: si uno se renombró o
    // se quedó sin personal, no tiene caso ofrecerlo.
    return departamentos.filter(d => asignados.includes(d));
  }, [esAdmin, sesion, colaboradores, departamentos]);

  const puedeCrearRol = misDepartamentos.length > 0;

  /**
   * El permiso es por departamento, no por autoría: quien puede programar un
   * área puede corregir cualquier rol de esa área, lo haya creado o no. Es lo
   * que hace falta cuando tres supervisores cubren la misma línea o alguien
   * falta y hay que ajustar su rol.
   */
  const puedeTocarRol = (rol: RolTurnos) =>
    esAdmin || misDepartamentos.includes((rol.departamento || '').trim().toUpperCase());

  /* ══════════════════ SUCESOS ══════════════════ */

  const [formSuceso, setFormSuceso] = useState({
    fecha: hoyISO(),
    noNomina: '',
    tipo: 'NO_SE_PRESENTO' as TipoSuceso,
    descripcion: ''
  });
  const [guardandoSuceso, setGuardandoSuceso] = useState(false);
  const [filtroSucesos, setFiltroSucesos] = useState('');

  const sucesosFiltrados = useMemo(() => {
    const t = filtroSucesos.trim().toUpperCase();
    if (!t) return sucesos;
    return sucesos.filter(s =>
      (s.nombreCompleto || '').toUpperCase().includes(t) ||
      (s.noNomina || '').includes(t) ||
      (s.departamento || '').toUpperCase().includes(t) ||
      (ETIQUETA_SUCESO[s.tipo] || '').toUpperCase().includes(t)
    );
  }, [sucesos, filtroSucesos]);

  const registrarSuceso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSuceso.noNomina || !formSuceso.fecha || guardandoSuceso) return;

    const c = activos.find(x => x.noNomina === formSuceso.noNomina);
    const nuevo: Suceso = {
      fecha: formSuceso.fecha,
      noNomina: formSuceso.noNomina,
      nombreCompleto: c ? c.nombreCompleto : 'Desconocido',
      departamento: c ? c.departamento : '',
      tipo: formSuceso.tipo,
      descripcion: formSuceso.descripcion.trim(),
      reportadoPorNomina: sesion?.nomina || '',
      reportadoPorNombre: sesion?.nombre || ''
    };

    setGuardandoSuceso(true);
    try {
      await saveSuceso(nuevo);
      setFormSuceso({ fecha: hoyISO(), noNomina: '', tipo: 'NO_SE_PRESENTO', descripcion: '' });
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el suceso. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoSuceso(false);
    }
  };

  const exportarSucesosExcel = () => {
    exportToExcel(sucesosFiltrados.map(s => ({
      'Fecha': s.fecha,
      '# Nómina': s.noNomina,
      'Colaborador': s.nombreCompleto,
      'Departamento': s.departamento,
      'Suceso': ETIQUETA_SUCESO[s.tipo] || s.tipo,
      'Descripción': s.descripcion || '',
      'Reportó': s.reportadoPorNombre || ''
    })), 'IMPREDIMEX_Sucesos');
  };

  const exportarSucesosPDF = () => {
    exportToPDF(
      'IMPREDIMEX — Bitácora de Sucesos',
      ['Fecha', '# Nómina', 'Colaborador', 'Depto.', 'Suceso', 'Descripción', 'Reportó'],
      sucesosFiltrados.map(s => [
        s.fecha, s.noNomina, s.nombreCompleto, s.departamento,
        ETIQUETA_SUCESO[s.tipo] || s.tipo, s.descripcion || '—', s.reportadoPorNombre || '—'
      ]),
      'Bitacora_Sucesos'
    );
  };

  /* ══════════════════ ROL DE TURNOS ══════════════════ */

  const [editandoRol, setEditandoRol] = useState<RolTurnos | null>(null);
  const [guardandoRol, setGuardandoRol] = useState(false);
  const [asistencias, setAsistencias] = useState<Set<string>>(new Set());
  // Sin esto, un rol abierto en pantalla nunca se enteraría de que el turno
  // terminó: React solo repinta cuando cambia el estado.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const [portapapeles, setPortapapeles] = useState<AsignacionTurno | null>(null);

  /* ── Panel de permisos (solo ADMIN) ── */
  const [panelPermisos, setPanelPermisos] = useState(false);
  const [buscaPermisos, setBuscaPermisos] = useState('');
  const [guardandoPermiso, setGuardandoPermiso] = useState('');

  const alternarDepartamento = async (c: Colaborador, depto: string) => {
    if (!esAdmin || guardandoPermiso) return;
    const actuales = (c.departamentosTurnos || []).map(d => d.trim().toUpperCase());
    const siguientes = actuales.includes(depto)
      ? actuales.filter(d => d !== depto)
      : [...actuales, depto].sort();
    setGuardandoPermiso(c.noNomina);
    try {
      await asignarDepartamentosTurnos(c.noNomina, siguientes, sesion?.nomina || '');
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el permiso. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoPermiso('');
    }
  };

  const alternarReporteTodas = async (c: Colaborador) => {
    if (!esAdmin || guardandoPermiso) return;
    setGuardandoPermiso(c.noNomina);
    try {
      await asignarReporteFaltasTodas(c.noNomina, !c.reporteFaltasTodas, sesion?.nomina || '');
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el permiso. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoPermiso('');
    }
  };

  const alternarCapturaPromociones = async (c: Colaborador) => {
    if (!esAdmin || guardandoPermiso) return;
    setGuardandoPermiso(c.noNomina);
    try {
      await asignarCapturaPromociones(c.noNomina, !c.capturaPromociones, sesion?.nomina || '');
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el permiso. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoPermiso('');
    }
  };

  /** Quien ya tiene algún permiso, primero; luego el resto. */
  const personasPermisos = useMemo(() => {
    const t = buscaPermisos.trim().toUpperCase();
    const base = t
      ? activos.filter(c =>
          (c.nombreCompleto || '').toUpperCase().includes(t) ||
          (c.noNomina || '').includes(t) ||
          (c.departamento || '').toUpperCase().includes(t))
      : activos;
    return [...base].sort((a, b) => {
      const na = ((a.departamentosTurnos || []).length || a.reporteFaltasTodas || a.capturaPromociones) ? 0 : 1;
      const nb = ((b.departamentosTurnos || []).length || b.reporteFaltasTodas || b.capturaPromociones) ? 0 : 1;
      if (na !== nb) return na - nb;
      return (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '');
    });
  }, [activos, buscaPermisos]);

  const nuevoRol = (): RolTurnos => ({
    nombre: '',
    departamento: misDepartamentos[0] || '',
    periodo: 'SEMANAL',
    fechaInicio: hoyISO(),
    asignaciones: {},
    creadoPorNomina: sesion?.nomina || '',
    creadoPorNombre: sesion?.nombre || ''
  });

  const dias = useMemo(
    () => editandoRol ? diasDelPeriodo(editandoRol.fechaInicio, editandoRol.periodo) : [],
    [editandoRol]
  );

  // Solo se consulta el rango del rol abierto. Se depende de la primera y la
  // última fecha, no del objeto entero, para no rehacer la consulta cada vez
  // que se toca una celda.
  const primerDia = dias[0] || '';
  const ultimoDia = dias[dias.length - 1] || '';

  useEffect(() => {
    if (!primerDia || !ultimoDia) { setAsistencias(new Set()); return; }
    const u = subscribeAsistenciasRango(primerDia, ultimoDia, setAsistencias);
    return () => u();
  }, [primerDia, ultimoDia]);

  /**
   * Estado de asistencia de una celda.
   *
   * Un descanso no se evalúa: no hay jornada que cumplir. Y la falta solo se
   * afirma cuando el turno ya terminó, porque antes de esa hora la ausencia de
   * revisión no significa nada: alguien de T2 entra a las 14:00 y darlo por
   * ausente en la mañana sería inventar una falta.
   *
   * El «Asistió», en cambio, aparece en cuanto se hace la revisión. Solo se
   * hace esperar al dato que puede equivocarse.
   */
  const estadoAsistencia = (noNomina: string, fecha: string, a?: AsignacionTurno) => {
    if (!a) return 'NA' as const;
    if (asistencias.has(`${noNomina}|${fecha}`)) return 'SI' as const;
    return turnoYaTermino(fecha, a, ahora) ? ('NO' as const) : ('NA' as const);
  };

  const personasDelRol = useMemo(() => {
    if (!editandoRol) return [];
    return activos
      .filter(c => (c.departamento || '').trim().toUpperCase() === editandoRol.departamento)
      .sort((a, b) => Number(a.noNomina) - Number(b.noNomina));
  }, [activos, editandoRol]);

  /**
   * Al cambiar periodo o fecha de inicio se conservan solo las asignaciones
   * cuyas fechas siguen dentro del rango nuevo. Las que quedan fuera se
   * descartan a propósito: arrastrarlas haría reaparecer turnos de días que
   * ya no forman parte del rol.
   */
  const recortarAlRango = (rol: RolTurnos, nuevosDias: string[]): Record<string, AsignacionTurno> => {
    const validas = new Set(nuevosDias);
    const out: Record<string, AsignacionTurno> = {};
    for (const [k, v] of Object.entries(rol.asignaciones || {})) {
      const fecha = k.split('|')[1];
      if (validas.has(fecha)) out[k] = v;
    }
    return out;
  };

  const cambiarCabecera = (campo: 'nombre' | 'departamento' | 'periodo' | 'fechaInicio', valor: string) => {
    setEditandoRol(prev => {
      if (!prev) return prev;
      const sig = { ...prev, [campo]: campo === 'periodo' ? (valor as PeriodoRol) : valor };
      if (campo === 'periodo' || campo === 'fechaInicio') {
        sig.asignaciones = recortarAlRango(sig, diasDelPeriodo(sig.fechaInicio, sig.periodo));
      }
      if (campo === 'departamento') {
        // Cambiar de departamento cambia la lista de personas: las
        // asignaciones de la anterior ya no corresponden a nadie del rol.
        sig.asignaciones = {};
      }
      return sig;
    });
  };

  const asignarTurno = (noNomina: string, fecha: string, clave: string) => {
    const k = claveCelda(noNomina, fecha);
    setEditandoRol(prev => {
      if (!prev) return prev;
      const asignaciones = { ...prev.asignaciones };
      if (!clave) {
        delete asignaciones[k];
      } else if (clave === 'LIB') {
        const hi = window.prompt('Hora de entrada (HH:MM, 24 h):', '08:00');
        if (hi === null) return prev;
        if (!HORA_VALIDA.test(hi)) { alert('Hora de entrada no válida. Usa el formato HH:MM en 24 horas.'); return prev; }
        const hf = window.prompt('Hora de salida (HH:MM, 24 h):', '18:00');
        if (hf === null) return prev;
        if (!HORA_VALIDA.test(hf)) { alert('Hora de salida no válida. Usa el formato HH:MM en 24 horas.'); return prev; }
        asignaciones[k] = { turno: 'LIB', horaInicio: hi, horaFin: hf };
      } else {
        asignaciones[k] = { turno: clave as ClaveTurno };
      }
      return { ...prev, asignaciones };
    });
  };

  const copiarCelda = (noNomina: string, fecha: string) => {
    const a = editandoRol?.asignaciones[claveCelda(noNomina, fecha)];
    if (!a) return;
    // Copia independiente: si después se edita la celda de origen, lo ya
    // pegado no cambia.
    setPortapapeles({ ...a });
  };

  const pegarEnCelda = (noNomina: string, fecha: string) => {
    if (!portapapeles) return;
    setEditandoRol(prev => prev ? {
      ...prev,
      asignaciones: { ...prev.asignaciones, [claveCelda(noNomina, fecha)]: { ...portapapeles } }
    } : prev);
  };

  const pegarFila = (noNomina: string) => {
    if (!portapapeles || !editandoRol) return;
    if (!window.confirm('¿Aplicar el turno copiado a todos los días del periodo de esta persona?')) return;
    setEditandoRol(prev => {
      if (!prev) return prev;
      const asignaciones = { ...prev.asignaciones };
      dias.forEach(f => { asignaciones[claveCelda(noNomina, f)] = { ...portapapeles }; });
      return { ...prev, asignaciones };
    });
  };

  const limpiarFila = (noNomina: string) => {
    setEditandoRol(prev => {
      if (!prev) return prev;
      const asignaciones = { ...prev.asignaciones };
      dias.forEach(f => { delete asignaciones[claveCelda(noNomina, f)]; });
      return { ...prev, asignaciones };
    });
  };

  const guardarRol = async () => {
    if (!editandoRol) return;
    if (!puedeTocarRol(editandoRol)) return;
    if (!editandoRol.nombre.trim()) { alert('El rol necesita un nombre.'); return; }
    if (!editandoRol.fechaInicio) { alert('El rol necesita una fecha de inicio.'); return; }
    if (!editandoRol.departamento) { alert('El rol necesita un departamento.'); return; }

    setGuardandoRol(true);
    try {
      await saveRolTurnos({ ...editandoRol, nombre: editandoRol.nombre.trim() });
      setEditandoRol(null);
      setPortapapeles(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el rol de turnos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoRol(false);
    }
  };

  const exportarRolExcel = async (rol: RolTurnos) => {
    const ds = diasDelPeriodo(rol.fechaInicio, rol.periodo);
    const personas = activos
      .filter(c => (c.departamento || '').trim().toUpperCase() === rol.departamento)
      .sort((a, b) => Number(a.noNomina) - Number(b.noNomina));

    // La exportación corre sobre un rol de la lista, no sobre el abierto, así
    // que sus asistencias se piden aquí. Si la consulta falla se avisa en vez
    // de exportar un archivo donde todos aparecerían ausentes.
    let asis: Set<string>;
    try {
      asis = await obtenerAsistenciasRango(ds[0] || '', ds[ds.length - 1] || '');
    } catch {
      alert('No se pudieron leer las asistencias. El archivo no se generó para no reportar faltas equivocadas.');
      return;
    }


    exportToExcel(personas.map(p => {
      const fila: Record<string, string> = {
        '# Nómina': p.noNomina,
        'Colaborador': p.nombreCompleto,
        'Puesto': p.puesto || ''
      };
      ds.forEach(f => {
        const a = rol.asignaciones[claveCelda(p.noNomina, f)];
        if (!a) { fila[f] = ''; return; }
        const turno = a.turno === 'LIB' ? `LIB ${a.horaInicio || ''}-${a.horaFin || ''}` : a.turno;
        // Misma regla que la pantalla: el «Asistió» en cuanto hay revisión, y
        // la falta solo si el turno ya terminó. Un turno en curso sale sin
        // marca, para no reportar como falta una jornada que no ha acabado.
        if (asis.has(`${p.noNomina}|${f}`)) { fila[f] = `${turno} · Asistió`; return; }
        fila[f] = turnoYaTermino(f, a) ? `${turno} · No asistió` : turno;
      });
      return fila;
    }), `IMPREDIMEX_Turnos_${rol.nombre.replace(/[^\w]+/g, '_')}`);
  };

  /* ══════════════════ REPORTE DE FALTAS ══════════════════ */

  const [modalReporte, setModalReporte] = useState(false);
  const [repDesde, setRepDesde] = useState(hoyISO());
  const [repHasta, setRepHasta] = useState(hoyISO());
  const [repDepto, setRepDepto] = useState('');
  const [repFilas, setRepFilas] = useState<null | Array<Record<string, string>>>(null);
  const [repCargando, setRepCargando] = useState(false);
  const [repError, setRepError] = useState('');

  /** Quien puede pedir el reporte de todas las áreas de una sola vez. */
  const puedeReporteTodas = useMemo(() => {
    if (esAdmin) return true;
    if (!sesion) return false;
    const yo = colaboradores.find(c => c.noNomina === sesion.nomina);
    return !!yo?.reporteFaltasTodas;
  }, [esAdmin, sesion, colaboradores]);

  /**
   * Faltas del periodo.
   *
   * Una falta solo existe donde hubo turno asignado, el turno ya terminó y no
   * hay revisión de EPP. Se recorren los roles porque son los que dicen quién
   * debía trabajar cada día: sin turno asignado no hay nada que faltar.
   */
  const generarReporte = async () => {
    if (!repDesde || !repHasta) { setRepError('Elige las dos fechas.'); return; }
    if (repDesde > repHasta) { setRepError('La fecha inicial es posterior a la final.'); return; }

    setRepCargando(true);
    setRepError('');
    setRepFilas(null);
    try {
      const asis = await obtenerAsistenciasRango(repDesde, repHasta);
      const ahoraRep = new Date();
      // Dos roles del mismo departamento pueden solaparse en fechas; sin esto
      // la misma falta se contaría dos veces.
      const vistos = new Set<string>();
      const filas: Array<Record<string, string>> = [];

      for (const rol of roles) {
        const deptoRol = (rol.departamento || '').trim().toUpperCase();
        if (repDepto !== '__TODOS__' && deptoRol !== repDepto) continue;

        const personas = activos.filter(c => (c.departamento || '').trim().toUpperCase() === deptoRol);
        for (const f of diasDelPeriodo(rol.fechaInicio, rol.periodo)) {
          if (f < repDesde || f > repHasta) continue;
          for (const per of personas) {
            const a = rol.asignaciones[claveCelda(per.noNomina, f)];
            if (!a) continue;
            if (!turnoYaTermino(f, a, ahoraRep)) continue;
            const k = `${per.noNomina}|${f}`;
            if (asis.has(k) || vistos.has(k)) continue;
            vistos.add(k);
            filas.push({
              'Fecha': f,
              '# Nómina': per.noNomina,
              'Colaborador': per.nombreCompleto,
              'Departamento': deptoRol,
              'Turno': a.turno === 'LIB' ? `LIB ${a.horaInicio || ''}-${a.horaFin || ''}` : a.turno,
              'Rol': rol.nombre
            });
          }
        }
      }

      filas.sort((x, y) => x['Fecha'].localeCompare(y['Fecha']) || x['Colaborador'].localeCompare(y['Colaborador']));
      setRepFilas(filas);
    } catch (err) {
      console.error(err);
      // Sin asistencias, todo turno terminado parecería falta: mejor no
      // entregar un reporte que acusaría a quien sí vino.
      setRepError('No se pudieron leer las asistencias. El reporte no se generó para no reportar faltas equivocadas.');
    } finally {
      setRepCargando(false);
    }
  };

  /**
   * Faltas de los últimos `grafDias` días, con la misma regla que el reporte:
   * hubo turno asignado, el turno ya terminó y no hay revisión de EPP.
   *
   * Respeta los mismos permisos: quien no puede ver todas las áreas solo
   * cuenta las de los departamentos que tiene asignados.
   */
  const calcularGrafica = async () => {
    const hoy = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hasta = iso(hoy);
    const desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (grafDias - 1)));

    setGrafCargando(true);
    setGrafError('');
    setGrafFaltas(null);
    try {
      const asis = await obtenerAsistenciasRango(desde, hasta);
      const ahora = new Date();
      const vistos = new Set<string>();
      const filas: { fecha: string; depto: string }[] = [];

      for (const rol of roles) {
        const deptoRol = (rol.departamento || '').trim().toUpperCase();
        if (!puedeReporteTodas && !departamentos.includes(deptoRol)) continue;

        const personas = activos.filter(c => (c.departamento || '').trim().toUpperCase() === deptoRol);
        for (const f of diasDelPeriodo(rol.fechaInicio, rol.periodo)) {
          if (f < desde || f > hasta) continue;
          for (const per of personas) {
            const a = rol.asignaciones[claveCelda(per.noNomina, f)];
            if (!a) continue;
            if (!turnoYaTermino(f, a, ahora)) continue;
            const k = `${per.noNomina}|${f}`;
            if (asis.has(k) || vistos.has(k)) continue;
            vistos.add(k);
            filas.push({ fecha: f, depto: deptoRol });
          }
        }
      }
      setGrafFaltas(filas);
    } catch (err) {
      console.error(err);
      // Sin asistencias todo turno terminado parecería falta: no se grafica
      // nada antes que pintar ausencias de gente que sí vino.
      setGrafError('No se pudieron leer las asistencias. La gráfica no se generó para no mostrar faltas equivocadas.');
    } finally {
      setGrafCargando(false);
    }
  };

  /** Faltas por día, en orden, para ver si se concentran en alguna fecha. */
  const faltasPorDia = useMemo(() => {
    if (!grafFaltas) return [];
    const hoy = new Date();
    const dias: { clave: string; etiqueta: string }[] = [];
    for (let i = grafDias - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      dias.push({
        clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        etiqueta: String(d.getDate())
      });
    }
    return dias.map(d => ({ etiqueta: d.etiqueta, valor: grafFaltas.filter(f => f.fecha === d.clave).length }));
  }, [grafFaltas, grafDias]);

  const faltasPorDepto = useMemo(() => {
    if (!grafFaltas) return [];
    const cuenta = new Map<string, number>();
    grafFaltas.forEach(f => cuenta.set(f.depto, (cuenta.get(f.depto) || 0) + 1));
    return [...cuenta.entries()].map(([etiqueta, valor]) => ({ etiqueta, valor }));
  }, [grafFaltas]);

  const abrirReporte = () => {
    setRepDepto(puedeReporteTodas ? '__TODOS__' : (departamentos[0] || ''));
    setRepFilas(null);
    setRepError('');
    setModalReporte(true);
  };

  const etiquetaPeriodo = `${repDesde}_a_${repHasta}`;

  /* ══════════════════ VISTA: permisos de programación ══════════════════ */

  if (panelPermisos && esAdmin) {
    return (
      <div className="card-industrial">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
          <button
            onClick={() => { setPanelPermisos(false); setBuscaPermisos(''); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="sec-title" style={{ margin: 0 }}>Quién puede programar turnos</div>
        </div>

        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.45 }}>
          Marca los departamentos que cada persona puede programar. Quien no tenga
          ninguno marcado solo consulta. Tú, como administrador, puedes programar
          todos sin necesidad de aparecer aquí. Las casillas de abajo son
          aparte y no conceden permiso para programar nada: una da acceso al
          reporte de faltas de todas las áreas, la otra permite capturar y
          calificar promociones internas. Cada marca se guarda al instante.
        </p>

        <input
          type="text" placeholder="Buscar por nombre, nómina o departamento…"
          value={buscaPermisos} onChange={e => setBuscaPermisos(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
        />

        {departamentos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
            No hay departamentos en el padrón todavía.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {personasPermisos.map(c => {
              const suyos = (c.departamentosTurnos || []).map(d => d.trim().toUpperCase());
              const ocupado = guardandoPermiso === c.noNomina;
              return (
                <div key={c.noNomina} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '9px 11px', background: (suyos.length || c.reporteFaltasTodas || c.capturaPromociones) ? 'var(--brand-navy-light)' : '#fff', opacity: ocupado ? 0.55 : 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--brand-navy-dark)' }}>
                    {c.nombreCompleto}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginBottom: '6px' }}>
                    #{c.noNomina} · {c.departamento || 'sin departamento'} · {c.puesto || 'sin puesto'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {departamentos.map(d => {
                      const activo = suyos.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => alternarDepartamento(c, d)}
                          disabled={ocupado}
                          style={{
                            fontSize: '9.5px', fontWeight: activo ? 700 : 400,
                            padding: '3px 9px', borderRadius: '20px',
                            border: '1px solid ' + (activo ? 'var(--brand-navy)' : 'var(--border-light)'),
                            background: activo ? 'var(--brand-navy)' : '#fff',
                            color: activo ? '#fff' : 'var(--text-secondary)',
                            cursor: ocupado ? 'wait' : 'pointer', fontFamily: 'inherit'
                          }}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)', cursor: ocupado ? 'wait' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!c.reporteFaltasTodas}
                      disabled={ocupado}
                      onChange={() => alternarReporteTodas(c)}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--brand-navy)', cursor: ocupado ? 'wait' : 'pointer' }}
                    />
                    Puede ver el reporte de faltas de todas las áreas
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '10px', color: 'var(--text-secondary)', cursor: ocupado ? 'wait' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!c.capturaPromociones}
                      disabled={ocupado}
                      onChange={() => alternarCapturaPromociones(c)}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--brand-navy)', cursor: ocupado ? 'wait' : 'pointer' }}
                    />
                    Puede capturar promociones internas
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════ VISTA: editor de rol ══════════════════ */

  if (editandoRol) {
    // Un rol ya guardado que no es propio se abre solo para mirarlo: sin
    // botón de guardar y con la cuadrícula deshabilitada, para que nadie
    // capture un periodo entero y descubra al final que no puede guardarlo.
    const soloLectura = !puedeTocarRol(editandoRol);

    return (
      <div>
        <div className="card-industrial" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <button
              onClick={() => { setEditandoRol(null); setPortapapeles(null); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', padding: 0 }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="sec-title" style={{ margin: 0 }}>
              {soloLectura ? 'Rol de turnos' : editandoRol.id ? 'Editar rol de turnos' : 'Nuevo rol de turnos'}
            </div>
          </div>

          {soloLectura && (
            <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', fontSize: '11.5px', color: '#003580' }}>
              Estás viendo un rol de {editandoRol.departamento || 'otro departamento'}, creado por {editandoRol.creadoPorNombre || 'otra persona'}. Solo quien tiene asignado ese departamento, o un administrador, puede modificarlo.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>NOMBRE DEL ROL *</label>
              <input
                type="text" value={editandoRol.nombre} placeholder="Ej. FLEXO SEMANA 38"
                onChange={e => cambiarCabecera('nombre', e.target.value)} disabled={soloLectura}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>DEPARTAMENTO *</label>
              <select value={editandoRol.departamento} onChange={e => cambiarCabecera('departamento', e.target.value)} disabled={soloLectura}>
                {/* Si es un rol ajeno en modo lectura, su departamento puede no
                    estar entre los míos; se agrega para que el campo no se vea
                    vacío. */}
                {(misDepartamentos.includes(editandoRol.departamento) || !editandoRol.departamento
                    ? misDepartamentos
                    : [editandoRol.departamento, ...misDepartamentos]
                ).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>PERIODO</label>
              <select value={editandoRol.periodo} onChange={e => cambiarCabecera('periodo', e.target.value)} disabled={soloLectura}>
                <option value="SEMANAL">Semanal (7 días)</option>
                <option value="QUINCENAL">Quincenal (14 días)</option>
                <option value="MENSUAL">Mensual (mes completo)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>FECHA DE INICIO *</label>
              <input type="date" value={editandoRol.fechaInicio} onChange={e => cambiarCabecera('fechaInicio', e.target.value)} disabled={soloLectura} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
            {CLAVES_TURNO.map(t => (
              <span key={t} style={{ fontSize: '9.5px', background: '#F3F6FA', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '3px 9px', color: 'var(--text-secondary)' }}>
                <b style={{ color: 'var(--brand-navy)' }}>{t}</b> {HORARIO_TURNO[t]}
              </span>
            ))}
            <span style={{ fontSize: '9.5px', background: '#F3F6FA', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '3px 9px', color: 'var(--text-secondary)' }}>
              Celda vacía = descanso
            </span>
            <span style={{ fontSize: '9.5px', background: '#F3F6FA', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '3px 9px', color: 'var(--text-secondary)' }}>
              ✓ asistió · ✗ no asistió, al terminar el turno
            </span>
          </div>

          {portapapeles && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: 'var(--brand-navy-light)', border: '1px solid var(--brand-navy)', borderRadius: '10px', padding: '8px 12px', marginTop: '10px', fontSize: '11.5px', color: 'var(--brand-navy)' }}>
              Turno copiado: <b>{portapapeles.turno}</b>
              {portapapeles.turno === 'LIB' && ` ${portapapeles.horaInicio}–${portapapeles.horaFin}`}
              <button
                onClick={() => setPortapapeles(null)}
                style={{ marginLeft: 'auto', border: '1px solid var(--brand-navy)', background: '#fff', color: 'var(--brand-navy)', borderRadius: '6px', fontSize: '10.5px', padding: '3px 9px', cursor: 'pointer' }}
              >
                <X size={11} style={{ verticalAlign: 'middle' }} /> Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="card-industrial">
          {personasDelRol.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
              No hay personal activo en {editandoRol.departamento || 'ese departamento'}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F3F6FA', minWidth: '185px', maxWidth: '185px', padding: '6px 8px', textAlign: 'left', fontSize: '9px', textTransform: 'uppercase', color: 'var(--brand-navy)', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)' }}>
                      Colaborador
                    </th>
                    {dias.map(f => {
                      const e = etiquetaDia(f);
                      return (
                        <th key={f} style={{ background: '#F3F6FA', padding: '6px 8px', fontSize: '9px', whiteSpace: 'nowrap', color: e.esDomingo ? 'var(--brand-red)' : 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)' }}>
                          {e.dow}<br />{e.num}
                        </th>
                      );
                    })}
                    <th style={{ background: '#F3F6FA', padding: '6px 8px', fontSize: '9px', textTransform: 'uppercase', color: 'var(--brand-navy)', borderBottom: '1px solid var(--border-light)' }}>
                      Fila
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {personasDelRol.map(p => (
                    <tr key={p.noNomina}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', minWidth: '185px', maxWidth: '185px', padding: '6px 8px', fontWeight: 600, fontSize: '10.5px', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', boxShadow: '1px 0 0 var(--border-light)' }}>
                        {p.nombreCompleto}
                        <span style={{ display: 'block', fontWeight: 400, fontSize: '9px', color: 'var(--text-light)' }}>#{p.noNomina}</span>
                      </td>
                      {dias.map(f => {
                        const k = claveCelda(p.noNomina, f);
                        const a = editandoRol.asignaciones[k];
                        return (
                          <td key={f} style={{ padding: '4px 5px', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <select
                                value={a?.turno || ''}
                                onChange={e => asignarTurno(p.noNomina, f, e.target.value)}
                                disabled={soloLectura}
                                style={{
                                  flex: 1, minWidth: '62px', height: '26px', padding: '2px 4px', fontSize: '10px',
                                  borderRadius: '6px', border: '1px solid ' + (a ? 'var(--brand-navy)' : 'var(--border-light)'),
                                  background: a ? 'var(--brand-navy-light)' : '#fff',
                                  fontWeight: a ? 700 : 400, color: 'var(--text-primary)', fontFamily: 'inherit'
                                }}
                              >
                                <option value="">—</option>
                                {CLAVES_TURNO.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              {(() => {
                                const est = estadoAsistencia(p.noNomina, f, a);
                                if (est === 'NA') return null;
                                return est === 'SI' ? (
                                  <Check size={13} strokeWidth={3} style={{ color: 'var(--green-dark)', flexShrink: 0 }}>
                                    <title>Asistió</title>
                                  </Check>
                                ) : (
                                  <X size={13} strokeWidth={3} style={{ color: 'var(--brand-red)', flexShrink: 0 }}>
                                    <title>No asistió</title>
                                  </X>
                                );
                              })()}
                            </div>
                            {a?.turno === 'LIB' && (
                              <span style={{ display: 'block', fontSize: '9px', color: 'var(--brand-navy)', fontWeight: 600, marginTop: '2px' }}>
                                {a.horaInicio}–{a.horaFin}
                              </span>
                            )}
                            <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                              {a && !soloLectura && (
                                <button onClick={() => copiarCelda(p.noNomina, f)} title="Copiar turno"
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-light)', padding: 0 }}>
                                  <Copy size={11} />
                                </button>
                              )}
                              {portapapeles && !soloLectura && (
                                <button onClick={() => pegarEnCelda(p.noNomina, f)} title="Pegar turno"
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: 0 }}>
                                  <ClipboardPaste size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        {portapapeles && !soloLectura && (
                          <button onClick={() => pegarFila(p.noNomina)} title="Pegar en toda la fila"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}>
                            <ClipboardPaste size={13} />
                          </button>
                        )}
                        {!soloLectura && (
                        <button onClick={() => limpiarFila(p.noNomina)} title="Limpiar la fila"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px' }}>
                          <Eraser size={13} />
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!soloLectura && (
          <button
            onClick={guardarRol}
            className="btn-industrial-primary"
            disabled={guardandoRol}
            style={{ marginTop: '12px', opacity: guardandoRol ? 0.5 : 1, cursor: guardandoRol ? 'not-allowed' : 'pointer' }}
          >
            <Plus size={16} /> {guardandoRol ? 'Guardando…' : 'Guardar rol de turnos'}
          </button>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════ VISTA: lista ══════════════════ */

  return (
    <div>
      {/* ─── Registrar suceso ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Reportar Suceso</div>
          </div>
          <form onSubmit={registrarSuceso} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>FECHA *</label>
              <input type="date" required value={formSuceso.fecha}
                onChange={e => setFormSuceso(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>COLABORADOR *</label>
              <select required value={formSuceso.noNomina}
                onChange={e => setFormSuceso(f => ({ ...f, noNomina: e.target.value }))}>
                <option value="">-- Selecciona nómina o nombre --</option>
                {activos.map(c => (
                  <option key={c.noNomina} value={c.noNomina}>
                    {c.noNomina} - {c.nombreCompleto} ({c.departamento})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>SUCESO *</label>
              <select value={formSuceso.tipo}
                onChange={e => setFormSuceso(f => ({ ...f, tipo: e.target.value as TipoSuceso }))}>
                {(Object.keys(ETIQUETA_SUCESO) as TipoSuceso[]).map(t => (
                  <option key={t} value={t}>{ETIQUETA_SUCESO[t]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={SUB}>DESCRIPCIÓN</label>
              <textarea
                rows={2} value={formSuceso.descripcion}
                placeholder="Qué pasó (opcional)"
                onChange={e => setFormSuceso(f => ({ ...f, descripcion: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: '52px', padding: '8px 10px', border: '1px solid rgba(0,32,96,0.15)', borderRadius: 'var(--radius-md)', background: '#fff', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.35, resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn-industrial-primary" disabled={guardandoSuceso}
              style={{ marginTop: '6px', opacity: guardandoSuceso ? 0.5 : 1, cursor: guardandoSuceso ? 'not-allowed' : 'pointer' }}>
              <Plus size={16} /> {guardandoSuceso ? 'Guardando…' : 'Registrar Suceso'}
            </button>
          </form>
        </div>

        {/* ─── Roles de turnos ─── */}
        <div className="card-industrial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="bar-accent"></div>
              <div className="sec-title" style={{ margin: 0 }}>Rol de Turnos ({roles.length})</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {esAdmin && (
                <button
                  onClick={() => setPanelPermisos(true)}
                  title="Quién puede programar turnos"
                  aria-label="Quién puede programar turnos"
                  style={BOTON_REDONDO}
                >
                  <ShieldCheck size={16} />
                </button>
              )}
              {puedeCrearRol && (
                <button
                  onClick={() => setEditandoRol(nuevoRol())}
                  title="Nuevo rol de turnos"
                  aria-label="Nuevo rol de turnos"
                  style={{ ...BOTON_REDONDO, background: 'var(--brand-navy)', borderColor: 'var(--brand-navy)', color: '#fff' }}
                >
                  <Plus size={17} />
                </button>
              )}
              <button
                onClick={abrirReporte}
                title="Reporte de faltas"
                aria-label="Reporte de faltas"
                style={BOTON_REDONDO}
              >
                <FileWarning size={16} />
              </button>
            </div>
          </div>

          {!puedeCrearRol && (
            <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '9px 12px', marginBottom: '9px', fontSize: '11px', color: '#003580', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Eye size={14} />
              Puedes consultar y exportar los roles, pero no crearlos.
            </div>
          )}

          {roles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
              Todavía no hay roles de turnos.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {roles.map(r => {
                const mio = puedeTocarRol(r);
                return (
                  <div key={r.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '9px 11px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--brand-navy-dark)' }}>{r.nombre}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {r.departamento} • {r.periodo.toLowerCase()} • desde {r.fechaInicio}
                        </div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                          Creado por {r.creadoPorNombre || '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                        <button onClick={() => exportarRolExcel(r)} title="Exportar a Excel"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--green-dark)', padding: '2px' }}>
                          <FileSpreadsheet size={14} />
                        </button>
                        <button onClick={() => setEditandoRol({ ...r, asignaciones: { ...r.asignaciones } })}
                          title={mio ? 'Editar rol' : 'Ver rol (solo quien lo creó o un administrador puede guardarlo)'}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}>
                          <Edit2 size={14} />
                        </button>
                        {mio && (
                          <button onClick={() => r.id && window.confirm(`¿Eliminar el rol "${r.nombre}"?`) && deleteRolTurnos(r.id)}
                            title="Eliminar rol"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Ventana del reporte de faltas ─── */}
      {modalReporte && (
        <div
          onClick={() => setModalReporte(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '620px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 50px rgba(0,20,60,.28)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="bar-accent"></div>
                <div className="sec-title" style={{ margin: 0 }}>Reporte de faltas</div>
              </div>
              <button onClick={() => setModalReporte(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={SUB}>DESDE *</label>
                  <input type="date" value={repDesde} onChange={e => { setRepDesde(e.target.value); setRepFilas(null); }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={SUB}>HASTA *</label>
                  <input type="date" value={repHasta} onChange={e => { setRepHasta(e.target.value); setRepFilas(null); }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={SUB}>DEPARTAMENTO</label>
                  <select value={repDepto} onChange={e => { setRepDepto(e.target.value); setRepFilas(null); }}>
                    {puedeReporteTodas && <option value="__TODOS__">Todos los departamentos</option>}
                    {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={generarReporte}
                className="btn-industrial-primary"
                disabled={repCargando}
                style={{ marginTop: '12px', opacity: repCargando ? 0.5 : 1, cursor: repCargando ? 'not-allowed' : 'pointer' }}
              >
                {repCargando ? 'Generando…' : 'Generar reporte'}
              </button>

              {repError && (
                <div style={{ marginTop: '10px', background: 'var(--red-light)', border: '1px solid rgba(192,57,43,.25)', borderRadius: '10px', padding: '9px 12px', fontSize: '11.5px', color: 'var(--brand-red)' }}>
                  {repError}
                </div>
              )}

              {repFilas && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-navy)' }}>
                      {repFilas.length === 0 ? 'Sin faltas en el periodo' : `${repFilas.length} falta${repFilas.length === 1 ? '' : 's'}`}
                    </div>
                    {repFilas.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => exportToExcel(repFilas, `IMPREDIMEX_Faltas_${etiquetaPeriodo}`)} className="btn-industrial-success" style={{ height: '28px' }}>
                          <FileSpreadsheet size={12} /> Excel
                        </button>
                        <button
                          onClick={() => exportToPDF(
                            'IMPREDIMEX — Reporte de faltas',
                            ['Fecha', '# Nómina', 'Colaborador', 'Depto.', 'Turno', 'Rol'],
                            repFilas.map(r => [r['Fecha'], r['# Nómina'], r['Colaborador'], r['Departamento'], r['Turno'], r['Rol']]),
                            `Reporte_Faltas_${etiquetaPeriodo}`
                          )}
                          className="btn-industrial-danger" style={{ height: '28px' }}
                        >
                          <FileText size={12} /> PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {repFilas.length === 0 ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Nadie con turno asignado y ya terminado se quedó sin revisión de EPP en esas fechas.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                            {['Fecha', '# Nómina', 'Colaborador', 'Depto.', 'Turno'].map(h => (
                              <th key={h} style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {repFilas.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r['Fecha']}</td>
                              <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{r['# Nómina']}</td>
                              <td style={{ padding: '5px 8px' }}>{r['Colaborador']}</td>
                              <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{r['Departamento']}</td>
                              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r['Turno']}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Bitácora ─── */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Bitácora de Sucesos ({sucesosFiltrados.length})</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={exportarSucesosExcel} className="btn-industrial-success" style={{ height: '30px' }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={exportarSucesosPDF} className="btn-industrial-danger" style={{ height: '30px' }}>
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>

        <input
          type="text" placeholder="Filtrar por nombre, nómina, departamento o suceso…"
          value={filtroSucesos} onChange={e => setFiltroSucesos(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
        />

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: 1.2 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Fecha', '# Nómina', 'Nombre', 'Depto.', 'Suceso', 'Descripción', 'Reportó'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>{h}</th>
                ))}
                {esAdmin && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {sucesosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={esAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    No hay sucesos registrados.
                  </td>
                </tr>
              ) : (
                sucesosFiltrados.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{s.fecha}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{s.noNomina}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{s.nombreCompleto}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{s.departamento || '—'}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ display: 'inline-block', background: s.tipo === 'ACCIDENTE' ? 'var(--red-light)' : 'var(--brand-navy-light)', color: s.tipo === 'ACCIDENTE' ? 'var(--brand-red)' : 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                        {ETIQUETA_SUCESO[s.tipo] || s.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'normal' }}>{s.descripcion || '—'}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'normal' }}>{s.reportadoPorNombre || '—'}</td>
                    {esAdmin && (
                      <td style={{ padding: '5px 8px' }}>
                        <button onClick={() => s.id && deleteSuceso(s.id)} title="Eliminar suceso"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* GRÁFICA DE FALTAS (SPEC-018) */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--brand-navy)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Faltas
            </div>
            <select
              value={grafDias}
              onChange={(e) => { setGrafDias(Number(e.target.value)); setGrafFaltas(null); }}
              style={{ height: '28px', fontSize: '10px', padding: '2px 6px', width: 'auto' }}
            >
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
            <button
              onClick={calcularGrafica}
              disabled={grafCargando}
              className="btn-industrial-primary"
              style={{ height: '28px', padding: '4px 10px', fontSize: '10px', width: 'auto' }}
            >
              {grafCargando ? 'Calculando…' : 'Calcular'}
            </button>
          </div>

          {grafError && (
            <div style={{ fontSize: '10.5px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '7px 10px', lineHeight: 1.45 }}>
              {grafError}
            </div>
          )}

          {!grafFaltas && !grafError && !grafCargando && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Elige el periodo y pulsa <b>Calcular</b>. No se calcula sola al abrir la pestaña porque hay que
              leer las revisiones de EPP de cada persona y cada día del periodo.
            </div>
          )}

          {grafFaltas && (
            <>
              <BarrasVerticales
                titulo={`Faltas por día (${grafFaltas.length} en el periodo)`}
                datos={faltasPorDia}
                color={COLORES.ROJO}
                nota="Una falta es un turno asignado que ya terminó sin que exista revisión de EPP de esa persona ese día."
                mensajeVacio="Sin faltas en el periodo."
              />
              <div style={{ marginTop: '12px' }}>
                <BarrasHorizontales
                  titulo="Faltas por departamento"
                  datos={faltasPorDepto}
                  color={COLORES.ROJO}
                  nota={puedeReporteTodas ? undefined : 'Solo se cuentan los departamentos que tienes asignados.'}
                  mensajeVacio="Sin faltas en el periodo."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
