import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import type { Colaborador, Incidencia } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeIncidencias, saveIncidencia, deleteIncidencia } from '../services/incidenciaService';

export const IncidenciasModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);

  const [form, setForm] = useState<Partial<Incidencia>>({
    noNomina: '',
    tipo: 'VACACIONES',
    fechaInicio: '',
    fechaFin: '',
    estatus: 'APROBADO'
  });

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubInc = subscribeIncidencias((data) => setIncidencias(data));
    return () => {
      unsubColab();
      unsubInc();
    };
  }, []);

  const calcularDias = (inicio?: string, fin?: string): number => {
    if (!inicio || !fin) return 1;
    const f1 = new Date(inicio);
    const f2 = new Date(fin);
    if (isNaN(f1.getTime()) || isNaN(f2.getTime())) return 1;
    const diffTime = f2.getTime() - f1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.noNomina || !form.fechaInicio || !form.fechaFin) return;

    const colaborador = colaboradores.find(c => c.noNomina === form.noNomina);
    const dias = calcularDias(form.fechaInicio, form.fechaFin);

    const nuevaIncidencia: Incidencia = {
      colaboradorId: form.noNomina,
      noNomina: form.noNomina,
      nombreCompleto: colaborador ? colaborador.nombreCompleto : 'Desconocido',
      tipo: form.tipo as any,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      diasTotales: dias,
      estatus: (form.estatus as any) || 'APROBADO'
    };

    saveIncidencia(nuevaIncidencia);

    setForm({
      noNomina: '',
      tipo: 'VACACIONES',
      fechaInicio: '',
      fechaFin: '',
      estatus: 'APROBADO'
    });
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '12px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#1a1a1a' }}>
          <ClipboardList size={24} color="#7c3aed" /> Registro de Asistencia e Incidencias
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#faf5ff' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#5b21b6' }}>
            <Plus size={18} /> Registrar Incidencia
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Seleccionar Colaborador *</label>
            <select
              required
              value={form.noNomina}
              onChange={(e) => setForm({ ...form, noNomina: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            >
              <option value="">-- Selecciona nómina o nombre --</option>
              {colaboradores.map((c) => (
                <option key={c.noNomina} value={c.noNomina}>
                  {c.noNomina} - {c.nombreCompleto} ({c.departamento})
                </option>
              ))}
            </select>

            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Tipo de Incidencia</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
            >
              <option value="VACACIONES">Vacaciones</option>
              <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
              <option value="FALTA_INJUSTIFICADA">Falta Injustificada</option>
              <option value="INCAPACIDAD">Incapacidad</option>
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Fecha Inicio</label>
                <input
                  type="date"
                  required
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Fecha Fin</label>
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
              style={{ marginTop: '6px', padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Guardar Incidencia
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Total de Incidencias Registradas</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed' }}>{incidencias.length}</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Días Totales Ausentados</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>
              {incidencias.reduce((acc, curr) => acc + (curr.diasTotales || 0), 0)} días
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Historial de Incidencias</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Nómina</th>
                <th style={{ padding: '10px' }}>Nombre</th>
                <th style={{ padding: '10px' }}>Tipo</th>
                <th style={{ padding: '10px' }}>Periodo</th>
                <th style={{ padding: '10px' }}>Días</th>
                <th style={{ padding: '10px' }}>Estatus</th>
                <th style={{ padding: '10px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {incidencias.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay incidencias registradas.
                  </td>
                </tr>
              ) : (
                incidencias.map((inc) => {
                  const badgeStyle = 
                    inc.tipo === 'VACACIONES' ? { bg: '#e0f2fe', text: '#0369a1' } :
                    inc.tipo === 'INCAPACIDAD' ? { bg: '#fef3c7', text: '#b45309' } :
                    inc.tipo === 'FALTA_JUSTIFICADA' ? { bg: '#f1f5f9', text: '#475569' } :
                    { bg: '#fee2e2', text: '#b91c1c' };

                  return (
                    <tr key={inc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{inc.noNomina}</td>
                      <td style={{ padding: '10px' }}>{inc.nombreCompleto}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: badgeStyle.bg, color: badgeStyle.text }}>
                          {inc.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontSize: '13px' }}>
                        {inc.fechaInicio} al {inc.fechaFin}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{inc.diasTotales} d</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                          <CheckCircle2 size={14} /> {inc.estatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => inc.id && deleteIncidencia(inc.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                          title="Eliminar incidencia"
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
