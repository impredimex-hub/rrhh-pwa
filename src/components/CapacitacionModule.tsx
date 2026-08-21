import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, Trash2, Calendar, CheckCircle2, Clock } from 'lucide-react';
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
      ? deptoTexto.split(',').map(d => d.trim()).filter(Boolean)
      : ['GENERAL'];

    saveCurso({
      titulo: form.titulo,
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '12px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#1a1a1a' }}>
          <GraduationCap size={24} color="#0284c7" /> Plan de Capacitación y Adiestramiento
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {/* Formulario de Creación */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f0f9ff' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1' }}>
            <Plus size={18} /> Programar Nuevo Curso
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="Nombre del Curso / Certificación *"
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <input
              type="text"
              placeholder="Instructor o Entidad Capacitadora"
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <input
              type="text"
              placeholder="Departamentos objetivo (ej: Impresión, Calidad)"
              value={deptoTexto}
              onChange={(e) => setDeptoTexto(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Fecha Inicio *</label>
                <input
                  type="date"
                  required
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Fecha Fin *</label>
                <input
                  type="date"
                  required
                  value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{ marginTop: '6px', padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Registrar Curso
            </button>
          </form>
        </div>

        {/* Resumen del Programa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Cursos Programados / Activos</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0284c7' }}>
              {cursos.filter(c => c.estatus !== 'FINALIZADO').length}
            </div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Cursos Concluidos</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
              {cursos.filter(c => c.estatus === 'FINALIZADO').length}
            </div>
          </div>
        </div>
      </div>

      {/* Listado de Programas */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Matriz de Programas de Capacitación ({cursos.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Curso</th>
                <th style={{ padding: '10px' }}>Instructor</th>
                <th style={{ padding: '10px' }}>Departamentos</th>
                <th style={{ padding: '10px' }}>Periodo</th>
                <th style={{ padding: '10px' }}>Estatus</th>
                <th style={{ padding: '10px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cursos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay cursos programados actualmente.
                  </td>
                </tr>
              ) : (
                cursos.map((curso) => {
                  const badge = 
                    curso.estatus === 'FINALIZADO' ? { bg: '#dcfce7', text: '#15803d' } :
                    curso.estatus === 'EN_CURSO' ? { bg: '#fef3c7', text: '#b45309' } :
                    { bg: '#e0f2fe', text: '#0369a1' };

                  return (
                    <tr key={curso.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#0f172a' }}>{curso.titulo}</td>
                      <td style={{ padding: '10px', color: '#475569' }}>{curso.instructor}</td>
                      <td style={{ padding: '10px' }}>
                        {curso.departamentosObjetivo?.map((d, i) => (
                          <span key={i} style={{ display: 'inline-block', background: '#f1f5f9', color: '#334155', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>
                            {d}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '10px', fontSize: '13px' }}>
                        {curso.fechaInicio} al {curso.fechaFin}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <select
                          value={curso.estatus}
                          onChange={(e) => handleCambiarEstatus(curso, e.target.value as any)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            border: 'none',
                            background: badge.bg,
                            color: badge.text,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="PROGRAMADO">PROGRAMADO</option>
                          <option value="EN_CURSO">EN CURSO</option>
                          <option value="FINALIZADO">FINALIZADO</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => curso.id && deleteCurso(curso.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                          title="Eliminar curso"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
