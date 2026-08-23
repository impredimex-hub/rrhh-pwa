import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import type { CursoCapacitacion } from '../types/rrhh';
import { subscribeCursos, saveCurso, deleteCurso } from '../services/capacitacionService';

export const CapacitacionModule: React.FC = () => {
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  const [form, setForm] = useState<Partial<CursoCapacitacion>>({
    titulo: '',
    instructor: '',
    departamentosObjetivo: [],
    puestosObjetivo: [],
    fechaInicio: '',
    fechaFin: '',
    estatus: 'PROGRAMADO'
  });

  const [deptoTexto, setDeptoTexto] = useState('');

  useEffect(() => {
    const unsub = subscribeCursos((data) => setCursos(data));
    return () => unsub();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.fechaInicio || !form.fechaFin) return;

    const deptos = deptoTexto
      ? deptoTexto.split(',').map(d => d.trim().toUpperCase()).filter(Boolean)
      : ['GENERAL'];

    saveCurso({
      titulo: form.titulo.toUpperCase(),
      instructor: form.instructor || 'Interno / Por Asignar',
      departamentosObjetivo: deptos,
      puestosObjetivo: form.puestosObjetivo || [],
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      estatus: (form.estatus as any) || 'PROGRAMADO'
    });

    setForm({
      titulo: '',
      instructor: '',
      departamentosObjetivo: [],
      puestosObjetivo: [],
      fechaInicio: '',
      fechaFin: '',
      estatus: 'PROGRAMADO'
    });
    setDeptoTexto('');
  };

  const handleCambiarEstatus = (curso: CursoCapacitacion, nuevoEstatus: 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO') => {
    saveCurso({ ...curso, estatus: nuevoEstatus });
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        {/* Formulario */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Programar Nuevo Curso</div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="Nombre del Curso / Certificación *"
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
            <input
              type="text"
              placeholder="Instructor o Entidad Capacitadora"
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            />
            <input
              type="text"
              placeholder="Departamentos objetivo (ej: Impresión, Calidad)"
              value={deptoTexto}
              onChange={(e) => setDeptoTexto(e.target.value)}
            />
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

            <button
              type="submit"
              className="btn-industrial-primary"
              style={{ marginTop: '6px' }}
            >
              <Plus size={16} /> Registrar Curso
            </button>
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
        <div className="card-title-bar">
          <div className="bar-accent"></div>
          <div className="sec-title" style={{ margin: 0 }}>Matriz de Capacitaciones ({cursos.length})</div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Curso</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Instructor</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamentos</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Periodo</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cursos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
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
                          fontSize: '9px',
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
                      <button
                        onClick={() => curso.id && deleteCurso(curso.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                        title="Eliminar curso"
                      >
                        <Trash2 size={13} />
                      </button>
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
