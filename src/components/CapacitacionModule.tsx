import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileSpreadsheet, FileText, ChevronDown, Check, Eye, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Colaborador, CursoCapacitacion, SesionCurso } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeCursos, saveCurso, deleteCurso } from '../services/capacitacionService';
import { usePermisos } from '../services/SesionContext';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { cursoAplicaA, avanceDelCurso, COLOR_AVANCE } from '../utils/cursos';
import { contarCompletadosDeCursos } from '../services/cursoCompletadoService';
import { hoyISO } from '../utils/fechas';

export const CapacitacionModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  
  const [deptosSeleccionados, setDeptosSeleccionados] = useState<string[]>([]);
  const [puestosSeleccionados, setPuestosSeleccionados] = useState<string[]>([]);
  const [menuDeptosAbierto, setMenuDeptosAbierto] = useState(false);
  const [menuPuestosAbierto, setMenuPuestosAbierto] = useState(false);

  const [cursoEditando, setCursoEditando] = useState<CursoCapacitacion | null>(null);

  const [form, setForm] = useState<Partial<CursoCapacitacion>>({
    titulo: '',
    instructor: '',
    estatus: 'PROGRAMADO'
  });

  /**
   * Los días del curso (SPEC-038). Un curso puede darse en varias fechas, y no
   * necesariamente seguidas, así que se capturan uno por uno en vez de un
   * tramo de inicio a fin.
   */
  const SESION_NUEVA: SesionCurso = { fecha: '', horaInicio: '09:00', horaFin: '11:00' };
  const [sesiones, setSesiones] = useState<SesionCurso[]>([{ ...SESION_NUEVA }]);

  /** Cambia cuántos días dura el curso, conservando lo ya capturado. */
  const cambiarDias = (cuantos: number) => {
    const n = Math.max(1, Math.min(20, cuantos || 1));
    setSesiones(prev => {
      if (n <= prev.length) return prev.slice(0, n);
      const extra = Array.from({ length: n - prev.length }, () => ({
        ...SESION_NUEVA,
        // Los días siguientes suelen llevar el mismo horario que el primero.
        horaInicio: prev[0]?.horaInicio || '09:00',
        horaFin: prev[0]?.horaFin || '11:00'
      }));
      return [...prev, ...extra];
    });
  };

  const cambiarSesion = (i: number, campo: keyof SesionCurso, valor: string) =>
    setSesiones(prev => prev.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));
  const { puedeCapturar } = usePermisos();

  /* ── Calendario de cumplimiento (SPEC-033) ─────────────────────────────
     Los completados se leen **al abrir**, no al cargar la pestaña: mientras
     nadie pida el calendario, no se descarga nada. */
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(hoyISO().slice(0, 7));
  /** Por curso: cuántos lo tomaron y a quiénes no les toca (SPEC-039). */
  const [avancePorCurso, setAvancePorCurso] = useState<Record<string, { tomaron: number; excluidos: string[] }>>({});
  const [cargandoCalendario, setCargandoCalendario] = useState(false);

  const abrirCalendario = async () => {
    setCalendarioAbierto(true);
    setMesCalendario(hoyISO().slice(0, 7));
    setCargandoCalendario(true);
    try {
      setAvancePorCurso(await contarCompletadosDeCursos(cursos.map(c => c.id || '').filter(Boolean)));
    } finally {
      setCargandoCalendario(false);
    }
  };

  /**
   * Cuántas personas del padrón activo le tocan a un curso.
   *
   * Sin descontar a quienes se les quitó el curso, saldrían como participantes
   * que faltan y hundirían el porcentaje sin remedio (SPEC-039).
   */
  const participantesDe = (curso: CursoCapacitacion) => {
    const fuera = new Set(avancePorCurso[curso.id || '']?.excluidos || []);
    return colaboradores.filter(
      c => c.estatus === 'ACTIVO' && cursoAplicaA(c, curso) && !fuera.has(c.noNomina)
    ).length;
  };

  /**
   * Resumen de un curso: participantes, cuántos lo tomaron, cuántos faltan y
   * en qué color va.
   */
  const resumenDeCurso = (curso: CursoCapacitacion) => {
    const total = participantesDe(curso);
    const tomaron = avancePorCurso[curso.id || '']?.tomaron || 0;
    // Nunca más de los que son: si alguien cambió de área después de tomarlo,
    // el conteo guardado podría superar al padrón de hoy.
    const tomaronReal = Math.min(tomaron, total);
    const { estado, porcentaje } = avanceDelCurso(curso, total, tomaronReal);
    return { total, tomaron: tomaronReal, faltan: Math.max(0, total - tomaronReal), estado, porcentaje };
  };

  /** Mes anterior o siguiente, contando sobre el texto `AAAA-MM` (regla R3). */
  const moverMes = (pasos: number) => {
    let anio = Number(mesCalendario.slice(0, 4));
    let mes = Number(mesCalendario.slice(5, 7)) + pasos;
    while (mes > 12) { mes -= 12; anio += 1; }
    while (mes < 1) { mes += 12; anio -= 1; }
    setMesCalendario(`${anio}-${String(mes).padStart(2, '0')}`);
  };

  /** Los cursos cuya fecha compromiso cae en el mes que se está viendo. */
  const cursosDelMes = cursos
    .filter(c => (c.fechaFin || '').slice(0, 7) === mesCalendario)
    .sort((a, b) => (a.fechaFin || '').localeCompare(b.fechaFin || ''));

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubCursos = subscribeCursos((data) => setCursos(data));
    return () => {
      unsubColab();
      unsubCursos();
    };
  }, []);

  const departamentosDisponibles = Array.from(
    new Set(colaboradores.map(c => (c.departamento || '').trim().toUpperCase()).filter(Boolean))
  ).sort();

  const puestosDisponibles = Array.from(
    new Set(
      colaboradores
        .filter(c => {
          if (deptosSeleccionados.length === 0) return true;
          return deptosSeleccionados.includes((c.departamento || '').trim().toUpperCase());
        })
        .map(c => (c.puesto || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();

  const toggleDepto = (depto: string) => {
    setDeptosSeleccionados(prev => 
      prev.includes(depto) ? prev.filter(d => d !== depto) : [...prev, depto]
    );
  };

  const togglePuesto = (puesto: string) => {
    setPuestosSeleccionados(prev => 
      prev.includes(puesto) ? prev.filter(p => p !== puesto) : [...prev, puesto]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeCapturar) return;
    if (!form.titulo) return;
    if (sesiones.some(s => !s.fecha)) { alert('Falta la fecha de alguno de los días.'); return; }

    const fechas = sesiones.map(s => s.fecha);
    if (new Set(fechas).size !== fechas.length) { alert('Hay dos días con la misma fecha.'); return; }

    // Se ordenan por fecha: se capturan en cualquier orden, pero el primero y
    // el último día tienen que ser los de verdad.
    const ordenadas = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(s => ({ fecha: s.fecha, horaInicio: s.horaInicio || '09:00', horaFin: s.horaFin || '11:00' }));

    const cursoData: CursoCapacitacion = {
      ...(cursoEditando ? { id: cursoEditando.id } : {}),
      titulo: form.titulo.toUpperCase().trim(),
      instructor: form.instructor ? form.instructor.toUpperCase().trim() : 'INTERNO / POR ASIGNAR',
      departamentosObjetivo: deptosSeleccionados.length > 0 ? deptosSeleccionados : ['GENERAL'],
      puestosObjetivo: puestosSeleccionados,
      sesiones: ordenadas,
      // Derivados de las sesiones, no capturados: el calendario de cumplimiento
      // y la matriz de Cursos siguen leyéndolos como siempre (SPEC-038).
      fechaInicio: ordenadas[0].fecha,
      fechaFin: ordenadas[ordenadas.length - 1].fecha,
      horaInicio: ordenadas[0].horaInicio,
      horaFin: ordenadas[0].horaFin,
      estatus: (form.estatus as any) || 'PROGRAMADO'
    };

    saveCurso(cursoData);

    setForm({ titulo: '', instructor: '', estatus: 'PROGRAMADO' });
    setSesiones([{ ...SESION_NUEVA }]);
    setDeptosSeleccionados([]);
    setPuestosSeleccionados([]);
    setCursoEditando(null);
  };

  const handleEditar = (curso: CursoCapacitacion) => {
    setCursoEditando(curso);
    setForm({ titulo: curso.titulo, instructor: curso.instructor, estatus: curso.estatus });
    // Un curso anterior a las sesiones se abre como uno o dos días: el de
    // inicio y el de fin. Si fueran el mismo, basta con uno.
    setSesiones(
      curso.sesiones && curso.sesiones.length
        ? curso.sesiones.map(s => ({ ...s }))
        : [
            { fecha: curso.fechaInicio, horaInicio: curso.horaInicio || '09:00', horaFin: curso.horaFin || '11:00' },
            ...(curso.fechaFin && curso.fechaFin !== curso.fechaInicio
              ? [{ fecha: curso.fechaFin, horaInicio: curso.horaInicio || '09:00', horaFin: curso.horaFin || '11:00' }]
              : [])
          ]
    );
    setDeptosSeleccionados(curso.departamentosObjetivo || []);
    setPuestosSeleccionados(curso.puestosObjetivo || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelarEdicion = () => {
    setCursoEditando(null);
    setForm({ titulo: '', instructor: '', estatus: 'PROGRAMADO' });
    setSesiones([{ ...SESION_NUEVA }]);
    setDeptosSeleccionados([]);
    setPuestosSeleccionados([]);
  };

  const handleCambiarEstatus = (curso: CursoCapacitacion, nuevoEstatus: 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO') => {
    if (!puedeCapturar) return;
    saveCurso({ ...curso, estatus: nuevoEstatus });
  };

  const handleExportExcel = () => {
    const data = cursos.map(c => ({
      'CURSO / CERTIFICACIÓN': c.titulo,
      'INSTRUCTOR / ENTIDAD': c.instructor || '-',
      'DEPARTAMENTOS OBJETIVO': c.departamentosObjetivo?.join(', ') || 'GENERAL',
      'PUESTOS OBJETIVO': c.puestosObjetivo?.length ? c.puestosObjetivo.join(', ') : 'TODOS',
      'DÍAS': c.sesiones?.length || 1,
      'FECHAS': c.sesiones?.length ? c.sesiones.map(s => s.fecha).join(' · ') : `${c.fechaInicio} al ${c.fechaFin}`,
      'FECHA INICIO': c.fechaInicio,
      'FECHA FIN': c.fechaFin,
      'HORARIO': `${c.horaInicio || '09:00'} - ${c.horaFin || '10:00'}`,
      'ESTATUS': c.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Plan_Capacitacion');
  };

  const handleExportPDF = () => {
    const headers = ['Curso / Certificación', 'Instructor', 'Departamentos', 'Puestos', 'Periodo', 'Horario', 'Estatus'];
    const rows = cursos.map(c => [
      c.titulo,
      c.instructor || '-',
      c.departamentosObjetivo?.join(', ') || 'GENERAL',
      c.puestosObjetivo?.length ? c.puestosObjetivo.join(', ') : 'TODOS',
      `${c.fechaInicio} al ${c.fechaFin}`,
      `${c.horaInicio || '09:00'} a ${c.horaFin || '10:00'}`,
      c.estatus
    ]);
    exportToPDF('IMPREDIMEX — Plan de Capacitación y Adiestramiento', headers, rows, 'Plan_Capacitacion');
  };

  return (
    <div>
      {!puedeCapturar && (
        <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1rem', fontSize: '11.5px', color: '#003580', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={15} />
          Estás viendo el plan de capacitación en modo consulta. La programación de cursos la hace un administrador de Recursos Humanos.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        
        {/* Formulario */}
        {puedeCapturar && (
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>
              {cursoEditando ? 'Editar Curso' : 'Programar Nuevo Curso'}
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>NOMBRE DEL CURSO / CERTIFICACIÓN *</label>
              <input
                type="text"
                placeholder="Ej. BPM Y SEGURIDAD INDUSTRIAL"
                required
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>INSTRUCTOR O ENTIDAD CAPACITADORA</label>
              <input
                type="text"
                placeholder="Ej. CALIDAD / CONSULTOR EXTERNO"
                value={form.instructor}
                onChange={(e) => setForm({ ...form, instructor: e.target.value })}
              />
            </div>

            {/* Departamentos Objetivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>DEPARTAMENTOS OBJETIVO</label>
              <div
                onClick={() => setMenuDeptosAbierto(!menuDeptosAbierto)}
                style={{
                  minHeight: '38px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(0,32,96,0.15)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: deptosSeleccionados.length > 0 ? 'var(--text-primary)' : '#8A9AB0'
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {deptosSeleccionados.length === 0
                    ? 'Seleccionar departamentos...'
                    : deptosSeleccionados.map(d => (
                        <span key={d} style={{ background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                          {d}
                        </span>
                      ))}
                </div>
                <ChevronDown size={14} color="var(--brand-navy)" />
              </div>

              {menuDeptosAbierto && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#ffffff', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', maxHeight: '180px', overflowY: 'auto', padding: '6px', marginTop: '4px' }}>
                  {departamentosDisponibles.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', padding: '6px' }}>No hay departamentos registrados en plantilla</div>
                  ) : (
                    departamentosDisponibles.map(depto => (
                      <div
                        key={depto}
                        onClick={() => toggleDepto(depto)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11.5px', background: deptosSeleccionados.includes(depto) ? 'var(--brand-navy-light)' : 'transparent', fontWeight: deptosSeleccionados.includes(depto) ? 600 : 400 }}
                      >
                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1px solid var(--brand-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: deptosSeleccionados.includes(depto) ? 'var(--brand-navy)' : '#fff' }}>
                          {deptosSeleccionados.includes(depto) && <Check size={10} color="#fff" />}
                        </div>
                        {depto}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Puestos Objetivo */}
            {deptosSeleccionados.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>PUESTOS OBJETIVO (OPCIONAL)</label>
                <div
                  onClick={() => setMenuPuestosAbierto(!menuPuestosAbierto)}
                  style={{
                    minHeight: '38px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(0,32,96,0.15)',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: puestosSeleccionados.length > 0 ? 'var(--text-primary)' : '#8A9AB0'
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {puestosSeleccionados.length === 0
                      ? 'Todos los puestos del departamento'
                      : puestosSeleccionados.map(p => (
                          <span key={p} style={{ background: 'var(--orange-light)', color: '#7A4500', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                            {p}
                          </span>
                        ))}
                  </div>
                  <ChevronDown size={14} color="var(--brand-navy)" />
                </div>

                {menuPuestosAbierto && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#ffffff', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', maxHeight: '180px', overflowY: 'auto', padding: '6px', marginTop: '4px' }}>
                    {puestosDisponibles.map(puesto => (
                      <div
                        key={puesto}
                        onClick={() => togglePuesto(puesto)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11.5px', background: puestosSeleccionados.includes(puesto) ? 'var(--orange-light)' : 'transparent', fontWeight: puestosSeleccionados.includes(puesto) ? 600 : 400 }}
                      >
                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1px solid var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: puestosSeleccionados.includes(puesto) ? 'var(--orange)' : '#fff' }}>
                          {puestosSeleccionados.includes(puesto) && <Check size={10} color="#fff" />}
                        </div>
                        {puesto}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Días del curso (SPEC-038). Primero cuántos son, y según eso
                aparece la fecha y el horario de cada uno. No hay fecha fin:
                los días pueden ser salteados. */}
            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>¿CUÁNTOS DÍAS DURA EL CURSO? *</label>
              <input
                type="number"
                min={1}
                max={20}
                value={sesiones.length}
                onChange={(e) => cambiarDias(Number(e.target.value))}
                style={{ maxWidth: '110px' }}
              />
            </div>

            {sesiones.map((s, i) => (
              <div key={i} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 12px', background: 'var(--bg-light)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '6px' }}>
                  {sesiones.length === 1 ? 'FECHA DEL CURSO' : `DÍA ${i + 1}`}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>FECHA *</label>
                    <input
                      type="date"
                      required
                      value={s.fecha}
                      onChange={(e) => cambiarSesion(i, 'fecha', e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 90px', minWidth: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>HORA INICIO</label>
                    <input
                      type="text"
                      placeholder="ej. 09:00"
                      value={s.horaInicio}
                      onChange={(e) => cambiarSesion(i, 'horaInicio', e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 90px', minWidth: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>HORA FIN</label>
                    <input
                      type="text"
                      placeholder="ej. 11:30"
                      value={s.horaFin}
                      onChange={(e) => cambiarSesion(i, 'horaFin', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="submit"
                className="btn-industrial-primary"
                style={{ flex: 2 }}
              >
                <Plus size={16} /> {cursoEditando ? 'Actualizar Curso' : 'Registrar Curso'}
              </button>
              {cursoEditando && (
                <button
                  type="button"
                  onClick={handleCancelarEdicion}
                  style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-mid)', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* Resumen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card-industrial">
            <div className="sec-title" style={{ color: 'var(--text-secondary)' }}>Cursos Programados / Activos</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--brand-navy)', marginTop: '4px' }}>
              {cursos.filter(c => c.estatus !== 'FINALIZADO').length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>en proceso</div>
          </div>
          <div className="card-industrial">
            <div className="sec-title" style={{ color: 'var(--text-secondary)' }}>Cursos Concluidos</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--green-dark)', marginTop: '4px' }}>
              {cursos.filter(c => c.estatus === 'FINALIZADO').length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>finalizados</div>
          </div>
        </div>
      </div>

      {/* Matriz */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Matriz de Capacitaciones ({cursos.length})</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Calendario de cumplimiento (SPEC-033). Va antes que Excel
                porque se consulta más que lo que se exporta. */}
            <button onClick={abrirCalendario} className="btn-circular btn-circular-navy" title="Calendario de cumplimiento">
              <CalendarDays size={14} />
            </button>
            <button onClick={handleExportExcel} className="btn-circular btn-circular-excel" title="Exportar a Excel">
              <FileSpreadsheet size={14} />
            </button>
            <button onClick={handleExportPDF} className="btn-circular btn-circular-pdf" title="Exportar a PDF">
              <FileText size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Curso</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Instructor</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamentos</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puestos</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Periodo y Horario</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
                {puedeCapturar && (
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {cursos.length === 0 ? (
                <tr>
                  <td colSpan={puedeCapturar ? 7 : 6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    No hay cursos programados actualmente.
                  </td>
                </tr>
              ) : (
                cursos.map((curso) => (
                  <tr key={curso.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy-dark)' }}>{curso.titulo}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{curso.instructor}</td>
                    <td style={{ padding: '5px 8px' }}>
                      {curso.departamentosObjetivo?.map((d, i) => (
                        <span key={i} style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', marginRight: '3px', fontWeight: 600 }}>
                          {d}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      {curso.puestosObjetivo && curso.puestosObjetivo.length > 0 ? (
                        curso.puestosObjetivo.map((p, i) => (
                          <span key={i} style={{ display: 'inline-block', background: 'var(--orange-light)', color: '#7A4500', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', marginRight: '3px', fontWeight: 600 }}>
                            {p}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '8.5px' }}>Todos</span>
                      )}
                    </td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>
                      {/* Un día por renglón, con su horario (SPEC-038). Los
                          cursos anteriores no traen sesiones y se siguen
                          mostrando como el tramo que eran. */}
                      {curso.sesiones && curso.sesiones.length ? (
                        <>
                          {curso.sesiones.length > 1 && (
                            <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>
                              {curso.sesiones.length} días
                            </div>
                          )}
                          {curso.sesiones.map((s, i) => (
                            <div key={i} style={{ whiteSpace: 'nowrap' }}>
                              {s.fecha}
                              <span style={{ fontSize: '8.5px', color: 'var(--brand-navy)', fontWeight: 'bold', marginLeft: '5px' }}>
                                {s.horaInicio} - {s.horaFin}
                              </span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div>{curso.fechaInicio} al {curso.fechaFin}</div>
                          <div style={{ fontSize: '8.5px', color: 'var(--brand-navy)', fontWeight: 'bold', marginTop: '2px' }}>
                            {curso.horaInicio || '09:00'} - {curso.horaFin || '10:00'}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <select
                        value={curso.estatus}
                        onChange={(e) => handleCambiarEstatus(curso, e.target.value as any)}
                        disabled={!puedeCapturar}
                        style={{
                          height: '24px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '8.5px',
                          fontWeight: 'bold',
                          border: 'none',
                          background: curso.estatus === 'FINALIZADO' ? 'var(--green-light)' : curso.estatus === 'EN_CURSO' ? 'var(--orange-light)' : 'var(--brand-navy-light)',
                          color: curso.estatus === 'FINALIZADO' ? 'var(--green-dark)' : curso.estatus === 'EN_CURSO' ? '#7A4500' : 'var(--brand-navy)',
                          cursor: puedeCapturar ? 'pointer' : 'default',
                          appearance: puedeCapturar ? 'auto' : 'none'
                        }}
                      >
                        <option value="PROGRAMADO">PROGRAMADO</option>
                        <option value="EN_CURSO">EN CURSO</option>
                        <option value="FINALIZADO">FINALIZADO</option>
                      </select>
                    </td>
                    {puedeCapturar && (
                    <td style={{ padding: '5px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handleEditar(curso)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                          title="Editar curso"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => curso.id && deleteCurso(curso.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px' }}
                          title="Eliminar curso"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CALENDARIO DE CUMPLIMIENTO (SPEC-033) ────────────────────────── */}
      {calendarioAbierto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', zIndex: 60, overflowY: 'auto' }}
          onClick={() => setCalendarioAbierto(false)}
        >
          <div
            className="card-industrial"
            style={{ width: '100%', maxWidth: '760px', marginTop: '12px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={18} color="var(--brand-navy)" />
                <div className="sec-title" style={{ margin: 0 }}>Calendario de cumplimiento</div>
              </div>
              <button onClick={() => setCalendarioAbierto(false)} title="Cerrar"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: 0, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
              Cada curso se coloca en su <b>fecha compromiso</b>. El color solo aparece cuando esa fecha
              ya pasó: verde si lo tomó todo el grupo, amarillo si va a la mitad o más, y rojo si va por
              debajo de la mitad. Los que aún no vencen se muestran en gris.
            </div>

            {/* Navegación del mes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
              <button onClick={() => moverMes(-1)} title="Mes anterior"
                style={{ border: '1px solid var(--border-mid)', background: '#fff', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--brand-navy)' }}>
                <ChevronLeft size={14} />
              </button>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--brand-navy)', minWidth: '150px', textAlign: 'center', textTransform: 'capitalize' }}>
                {new Date(Number(mesCalendario.slice(0, 4)), Number(mesCalendario.slice(5, 7)) - 1, 1)
                  .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => moverMes(1)} title="Mes siguiente"
                style={{ border: '1px solid var(--border-mid)', background: '#fff', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--brand-navy)' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Cuadrícula del mes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '12px' }}>
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                <div key={d} style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', textAlign: 'center', padding: '2px 0' }}>{d}</div>
              ))}
              {(() => {
                const anio = Number(mesCalendario.slice(0, 4));
                const mes = Number(mesCalendario.slice(5, 7));
                // `new Date(anio, mes-1, dia)` con números es seguro; lo que no
                // se puede es construirlo desde la cadena (regla R3).
                const primerDia = new Date(anio, mes - 1, 1).getDay();
                const diasDelMes = new Date(anio, mes, 0).getDate();
                const celdas: React.ReactNode[] = [];

                for (let i = 0; i < primerDia; i++) celdas.push(<div key={`v${i}`} />);

                for (let d = 1; d <= diasDelMes; d++) {
                  const iso = `${mesCalendario}-${String(d).padStart(2, '0')}`;
                  const delDia = cursosDelMes.filter(c => c.fechaFin === iso);
                  const esHoy = iso === hoyISO();
                  celdas.push(
                    <div key={iso} style={{
                      minHeight: '54px', border: '1px solid ' + (esHoy ? 'var(--brand-navy)' : 'var(--border-light)'),
                      borderRadius: '6px', padding: '3px', background: '#fff'
                    }}>
                      <div style={{ fontSize: '8.5px', fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--brand-navy)' : 'var(--text-light)', marginBottom: '2px' }}>{d}</div>
                      {delDia.map(c => {
                        const r = resumenDeCurso(c);
                        const col = COLOR_AVANCE[r.estado];
                        return (
                          <div key={c.id} title={`${c.titulo} — ${r.tomaron} de ${r.total}`}
                            style={{
                              background: col.fondo, color: col.texto, border: `1px solid ${col.borde}`,
                              borderRadius: '4px', padding: '1px 3px', fontSize: '7.5px', fontWeight: 700,
                              marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                            {c.titulo}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return celdas;
              })()}
            </div>

            {/* Detalle del mes */}
            {cargandoCalendario ? (
              <div style={{ textAlign: 'center', padding: '1rem', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Contando quién ya lo tomó…
              </div>
            ) : cursosDelMes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.2rem', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                No hay cursos con fecha compromiso en este mes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cursosDelMes.map(c => {
                  const r = resumenDeCurso(c);
                  const col = COLOR_AVANCE[r.estado];
                  return (
                    <div key={c.id} style={{ background: col.fondo, border: `1px solid ${col.borde}`, borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: col.texto }}>{c.titulo}</div>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: col.texto, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {col.etiqueta}{r.total > 0 && ` · ${r.porcentaje}%`}
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: col.texto, opacity: .85, marginTop: '3px', lineHeight: 1.5 }}>
                        Instructor: {c.instructor || 'sin instructor'} · Fecha compromiso: {c.fechaFin || '—'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: col.texto, marginTop: '4px' }}>
                        <b>{r.total}</b> participante{r.total === 1 ? '' : 's'} ·
                        {' '}<b>{r.tomaron}</b> lo tomaron ·
                        {' '}<b>{r.faltan}</b> falta{r.faltan === 1 ? '' : 'n'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
