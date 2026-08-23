import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, CheckCircle2, FileSpreadsheet, FileText } from 'lucide-react';
import type { Colaborador, Incidencia } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeIncidencias, saveIncidencia, deleteIncidencia } from '../services/incidenciaService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const IncidenciasModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);

  const [form, setForm] = useState<Partial<Incidencia>>({
    noNomina: '',
    tipo: 'FALTA_INJUSTIFICADA',
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
      tipo: 'FALTA_INJUSTIFICADA',
      fechaInicio: '',
      fechaFin: '',
      estatus: 'APROBADO'
    });
  };

  const handleExportExcel = () => {
    const data = incidencias.map(i => ({
      '# Nómina': i.noNomina,
      'Colaborador': i.nombreCompleto,
      'Tipo de Incidencia': i.tipo === 'INCIDENCIA_RIT' ? 'Incidencia RIT' : i.tipo.replace('_', ' '),
      'Fecha Inicio': i.fechaInicio,
      'Fecha Fin': i.fechaFin,
      'Días Totales': i.diasTotales,
      'Estatus': i.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Incidencias');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Colaborador', 'Tipo', 'Periodo', 'Días', 'Estatus'];
    const rows = incidencias.map(i => [
      i.noNomina,
      i.nombreCompleto,
      i.tipo === 'INCIDENCIA_RIT' ? 'Incidencia RIT' : i.tipo.replace('_', ' '),
      `${i.fechaInicio} al ${i.fechaFin}`,
      `${i.diasTotales} d`,
      i.estatus
    ]);
    exportToPDF('IMPREDIMEX — Registro de Incidencias', headers, rows, 'Registro_Incidencias');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        
        {/* Formulario */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Registrar Incidencia</div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>SELECCIONAR COLABORADOR *</label>
              <select
                required
                value={form.noNomina}
                onChange={(e) => setForm({ ...form, noNomina: e.target.value })}
              >
                <option value="">-- Selecciona nómina o nombre --</option>
                {colaboradores.map((c) => (
                  <option key={c.noNomina} value={c.noNomina}>
                    {c.noNomina} - {c.nombreCompleto} ({c.departamento})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>TIPO DE INCIDENCIA *</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
              >
                <option value="FALTA_INJUSTIFICADA">Falta injustificada</option>
                <option value="INCIDENCIA_RIT">Incidencia RIT</option>
                <option value="INCAPACIDAD">Incapacidad</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>FECHA INICIO</label>
                <input
                  type="date"
                  required
                  value={form.fechaInicio}
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>FECHA FIN</label>
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
              <Plus size={16} /> Guardar Incidencia
            </button>
          </form>
        </div>

        {/* Resumen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card-industrial">
            <div className="sec-title" style={{ color: 'var(--text-secondary)' }}>Total de Incidencias</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--brand-navy)', marginTop: '4px' }}>
              {incidencias.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>registros activos</div>
          </div>
          <div className="card-industrial">
            <div className="sec-title" style={{ color: 'var(--text-secondary)' }}>Días Totales Ausentados</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--brand-red)', marginTop: '4px' }}>
              {incidencias.reduce((acc, curr) => acc + (curr.diasTotales || 0), 0)} <span style={{ fontSize: '16px' }}>días</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>acumulados</div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Historial de Incidencias ({incidencias.length})</div>
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
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Periodo</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Días</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {incidencias.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    No hay incidencias registradas.
                  </td>
                </tr>
              ) : (
                incidencias.map((inc) => {
                  const badgeCls = 
                    inc.tipo === 'INCAPACIDAD' ? 'badge-warn' :
                    inc.tipo === 'INCIDENCIA_RIT' ? 'badge-navy' : 'badge-nok';

                  return (
                    <tr key={inc.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{inc.noNomina}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{inc.nombreCompleto}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ display: 'inline-block', background: badgeCls === 'badge-warn' ? 'var(--orange-light)' : badgeCls === 'badge-navy' ? 'var(--brand-navy-light)' : 'var(--red-light)', color: badgeCls === 'badge-warn' ? '#7A4500' : badgeCls === 'badge-navy' ? 'var(--brand-navy)' : 'var(--brand-red)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                          {inc.tipo === 'INCIDENCIA_RIT' ? 'Incidencia RIT' : inc.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>
                        {inc.fechaInicio} al {inc.fechaFin}
                      </td>
                      <td style={{ padding: '5px 8px', fontWeight: 'bold' }}>{inc.diasTotales} d</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'var(--green-dark)', fontWeight: 'bold' }}>
                          <CheckCircle2 size={11} /> {inc.estatus}
                        </span>
                      </td>
                      <td style={{ padding: '5px 8px' }}>
                        <button
                          onClick={() => inc.id && deleteIncidencia(inc.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                          title="Eliminar incidencia"
                        >
                          <Trash2 size={13} />
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
