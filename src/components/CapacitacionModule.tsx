import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileSpreadsheet, FileText, ChevronDown, Check } from 'lucide-react';
import type { Colaborador, CursoCapacitacion } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeCursos, saveCurso, deleteCurso } from '../services/capacitacionService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

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
    fechaInicio: '',
    fechaFin: '',
    estatus: 'PROGRAMADO'
  });

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubCursos = subscribeCursos((data) => setCursos(data));
    return () => {
      unsubColab();
      unsubCursos();
    };
  }, []);

  // Lista dinámica de departamentos únicos extraídos de la plantilla
  const departamentosDisponibles = Array.from(
    new Set(colaboradores.map(c => (c.departamento || '').trim().toUpperCase()).filter(Boolean))
  ).sort();

  // Lista dinámica de puestos correspondientes a los departamentos seleccionados
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
    setDeptosSeleccionados(prev => {
      const nuevo = prev.includes(depto) ? prev.filter(d => d !== depto) : [...prev, depto];
      return nuevo;
    });
  };

  const togglePuesto = (puesto: string) => {
    setPuestosSeleccionados(prev => 
      prev.includes(puesto) ? prev.filter(p => p !== puesto) : [...prev, puesto]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.fechaInicio || !form.fechaFin) return;

    const cursoData: CursoCapacitacion = {
      ...(cursoEditando ? { id: cursoEditando.id } : {}),
      titulo: form.titulo.toUpperCase(),
      instructor: form.instructor ? form.instructor.toUpperCase() : 'INTERNO / POR ASIGNAR',
      departamentosObjetivo: deptosSeleccionados.length > 0 ? deptosSeleccionados : ['GENERAL'],
      puestosObjetivo: puestosSeleccionados,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      estatus: (form.estatus as any) || 'PROGRAMADO'
    };

    saveCurso(cursoData);

    // Resetear formulario
    setForm({
      titulo: '',
      instructor: '',
      fechaInicio: '',
      fechaFin: '',
      estatus: 'PROGRAMADO'
    });
    setDeptosSeleccionados([]);
    setPuestosSeleccionados([]);
    setCursoEditando(null);
  };

  const handleEditar = (curso: CursoCapacitacion) => {
    setCursoEditando(curso);
    setForm({
      titulo: curso.titulo,
      instructor: curso.instructor,
      fechaInicio: curso.fechaInicio,
      fechaFin: curso.fechaFin,
      estatus: curso.estatus
    });
    setDeptosSeleccionados(curso.departamentosObjetivo || []);
    setPuestosSeleccionados(curso.puestosObjetivo || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelarEdicion = () => {
    setCursoEditando(null);
    setForm({
      titulo: '',
      instructor: '',
      fechaInicio: '',
      fechaFin: '',
      estatus: 'PROGRAMADO'
    });
    setDeptosSeleccionados([]);
    setPuestosSeleccionados([]);
  };

  const handleCambiarEstatus = (curso: CursoCapacitacion, nuevoEstatus: 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO') => {
    saveCurso({ ...curso, estatus: nuevoEstatus });
  };

  const handleExportExcel = () => {
    const data = cursos.map(c => ({
      'CURSO / CERTIFICACIÓN': c.titulo,
      'INSTRUCTOR / ENTIDAD': c.instructor || '-',
      'DEPARTAMENTOS OBJETIVO': c.departamentosObjetivo?.join(', ') || 'GENERAL',
      'PUESTOS OBJETIVO': c.puestosObjetivo?.length ? c.puestosObjetivo.join(', ') : 'TODOS',
      'FECHA INICIO': c.fechaInicio,
      'FECHA FIN': c.fechaFin,
      'ESTATUS': c.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Plan_Capacitacion');
  };

  const handleExportPDF = () => {
    const headers = ['Curso / Certificación', 'Instructor', 'Departamentos', 'Puestos', 'Periodo', 'Estatus'];
    const rows = cursos.map(c => [
      c.titulo,
      c.instructor || '-',
      c.departamentosObjetivo?.join(', ') || 'GENERAL',
      c.puestosObjetivo?.length ? c.puestosObjetivo.join(', ') : 'TODOS',
      `${c.fechaInicio} al ${c.fechaFin}`,
      c.estatus
    ]);
    exportToPDF('IMPREDIMEX — Plan de Capacitación y Adiestramiento', headers, rows, 'Plan_Capacitacion');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        
        {/* Formulario */}
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

            {/* Filtro desplegable: Departamentos Objetivo */}
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

            {/* Filtro desplegable: Puestos Objetivo */}
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>FECHA INICIO *</label>
                <input
                  type="date"
                  required
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>FECHA FIN *</label>
                <input
                  type="date"
                  required
                  value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                />
              </div>
            </div>

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
            <button onClick={handleExportExcel} className="btn-industrial-success" style={{ height: '30px' }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn-industrial-danger" style={{ height: '30px' }}>
              <FileText size={13} /> PDF
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
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Periodo</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cursos.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
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
                      {curso.fechaInicio} al {curso.fechaFin}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <select
                        value={curso.estatus}
                        onChange={(e) => handleCambiarEstatus(curso, e.target.value as any)}
                        style={{
                          height: '24px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '8.5px',
                          fontWeight: 'bold',
                          border: 'none',
                          background: curso.estatus === 'FINALIZADO' ? 'var(--green-light)' : curso.estatus === 'EN_CURSO' ? 'var(--orange-light)' : 'var(--brand-navy-light)',
                          color: curso.estatus === 'FINALIZADO' ? 'var(--green-dark)' : curso.estatus === 'EN_CURSO' ? '#7A4500' : 'var(--brand-navy)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="PROGRAMADO">PROGRAMADO</option>
                        <option value="EN_CURSO">EN CURSO</option>
                        <option value="FINALIZADO">FINALIZADO</option>
                      </select>
                    </td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
