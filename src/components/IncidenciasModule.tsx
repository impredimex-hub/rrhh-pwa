import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Colaborador, Incidencia, TipoIncidencia } from '../types/rrhh';
import { ETIQUETA_INCIDENCIA } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeIncidencias, saveIncidencia, deleteIncidencia } from '../services/incidenciaService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const pad2 = (n: number) => n.toString().padStart(2, '0');
const aISO = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

type Celda = { dia: number; iso: string } | null;

const construirCeldas = (base: Date): Celda[] => {
  const y = base.getFullYear();
  const m = base.getMonth();
  const primerDiaSemana = new Date(y, m, 1).getDay(); // 0=domingo
  let offset = primerDiaSemana - 1; // que la semana empiece en lunes
  if (offset < 0) offset = 6;
  const diasEnMes = new Date(y, m + 1, 0).getDate();

  const celdas: Celda[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push({ dia: d, iso: aISO(y, m, d) });
  return celdas;
};

const nombreMes = (d: Date) => {
  const t = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

interface FormIncidencia {
  noNomina: string;
  tipo: TipoIncidencia;
  observaciones: string;
  suspension: boolean;
  diasSuspension?: number;
  fechasSuspension: string[];
}

const FORM_VACIO: FormIncidencia = {
  noNomina: '',
  tipo: 'FALTA_INJUSTIFICADA',
  observaciones: '',
  suspension: false,
  diasSuspension: undefined,
  fechasSuspension: []
};

export const IncidenciasModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [form, setForm] = useState<FormIncidencia>(FORM_VACIO);
  const [mesVista, setMesVista] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubInc = subscribeIncidencias((data) => setIncidencias(data));
    return () => {
      unsubColab();
      unsubInc();
    };
  }, []);

  const suspensionIncompleta =
    form.suspension &&
    (!form.diasSuspension || form.diasSuspension < 1 || form.fechasSuspension.length !== form.diasSuspension);

  const toggleSuspension = (activa: boolean) => {
    setForm((f) => ({
      ...f,
      suspension: activa,
      diasSuspension: activa ? f.diasSuspension : undefined,
      fechasSuspension: activa ? f.fechasSuspension : []
    }));
  };

  const cambiarDiasSuspension = (valor: string) => {
    const n = parseInt(valor, 10);
    setForm((f) => ({
      ...f,
      diasSuspension: isNaN(n) || n < 1 ? undefined : n,
      fechasSuspension: [] // cambiar el número obliga a re-elegir los días
    }));
  };

  const toggleFecha = (iso: string) => {
    setForm((f) => {
      const yaEsta = f.fechasSuspension.includes(iso);
      if (yaEsta) {
        return { ...f, fechasSuspension: f.fechasSuspension.filter((d) => d !== iso) };
      }
      if (!f.diasSuspension || f.fechasSuspension.length >= f.diasSuspension) return f;
      return { ...f, fechasSuspension: [...f.fechasSuspension, iso].sort() };
    });
  };

  const cambiarMes = (delta: number) => {
    setMesVista((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.noNomina || !form.tipo) return;
    if (suspensionIncompleta) return;
    if (guardando) return;

    const colaborador = colaboradores.find((c) => c.noNomina === form.noNomina);

    // Los campos de suspensión se agregan solo si aplican. No se pueden
    // mandar con valor undefined: Firestore rechaza el documento completo si
    // encuentra uno, y antes eso hacía que una incidencia sin suspensión
    // fallara al guardar mientras el formulario se limpiaba igual.
    const nuevaIncidencia: Incidencia = {
      colaboradorId: form.noNomina,
      noNomina: form.noNomina,
      nombreCompleto: colaborador ? colaborador.nombreCompleto : 'Desconocido',
      tipo: form.tipo,
      observaciones: form.observaciones.trim(),
      suspension: form.suspension,
      fechasSuspension: form.suspension ? [...form.fechasSuspension] : []
    };
    if (form.suspension && form.diasSuspension) {
      nuevaIncidencia.diasSuspension = form.diasSuspension;
    }

    setGuardando(true);
    try {
      await saveIncidencia(nuevaIncidencia);
      // Solo se limpia si de verdad quedó guardada.
      setForm(FORM_VACIO);
      setMesVista(new Date());
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar la incidencia. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleExportExcel = () => {
    const data = incidencias.map((i) => ({
      '# Nómina': i.noNomina,
      'Colaborador': i.nombreCompleto,
      'Tipo de Incidencia': ETIQUETA_INCIDENCIA[i.tipo] || i.tipo,
      'Suspensión': i.suspension && i.fechasSuspension?.length ? i.fechasSuspension.join(', ') : '—',
      'Observaciones': i.observaciones || ''
    }));
    exportToExcel(data, 'IMPREDIMEX_Incidencias');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Colaborador', 'Tipo', 'Suspensión', 'Observaciones'];
    const rows = incidencias.map((i) => [
      i.noNomina,
      i.nombreCompleto,
      ETIQUETA_INCIDENCIA[i.tipo] || i.tipo,
      i.suspension && i.fechasSuspension?.length ? i.fechasSuspension.join(', ') : '—',
      i.observaciones || '—'
    ]);
    exportToPDF('IMPREDIMEX — Registro de Incidencias', headers, rows, 'Registro_Incidencias');
  };

  const diasSuspensionAcumulados = incidencias.reduce(
    (acc, curr) => acc + (curr.suspension ? curr.fechasSuspension?.length || 0 : 0),
    0
  );

  const celdas = construirCeldas(mesVista);

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
                onChange={(e) => setForm((f) => ({ ...f, noNomina: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoIncidencia }))}
              >
                {(Object.keys(ETIQUETA_INCIDENCIA) as TipoIncidencia[]).map((t) => (
                  <option key={t} value={t}>{ETIQUETA_INCIDENCIA[t]}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>OBSERVACIONES</label>
              <textarea
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                placeholder="Detalles adicionales (opcional)"
                style={{
                  width: '100%', boxSizing: 'border-box', minHeight: '52px', padding: '8px 10px',
                  border: '1px solid rgba(0,32,96,0.15)', borderRadius: 'var(--radius-md)',
                  background: '#fff', color: 'var(--text-primary)', fontSize: '13px',
                  fontFamily: 'inherit', lineHeight: 1.35, resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
              <input
                type="checkbox"
                id="chk-suspension"
                checked={form.suspension}
                onChange={(e) => toggleSuspension(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-navy)', cursor: 'pointer' }}
              />
              <label htmlFor="chk-suspension" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--brand-navy)', cursor: 'pointer' }}>
                Suspensión
              </label>
            </div>

            {form.suspension && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'var(--brand-navy-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>NÚMERO DE DÍAS *</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.diasSuspension ?? ''}
                    onChange={(e) => cambiarDiasSuspension(e.target.value)}
                    placeholder="Ej. 3"
                  />
                </div>

                {!!form.diasSuspension && form.diasSuspension > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => cambiarMes(-1)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '4px' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--brand-navy)' }}>
                        {nombreMes(mesVista)}
                      </div>
                      <button
                        type="button"
                        onClick={() => cambiarMes(1)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '4px' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', fontSize: '9px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      {DIAS_SEMANA.map((d, i) => <div key={i}>{d}</div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                      {celdas.map((c, i) => {
                        if (!c) return <div key={i}></div>;
                        const seleccionado = form.fechasSuspension.includes(c.iso);
                        const limiteAlcanzado = !seleccionado && form.fechasSuspension.length >= (form.diasSuspension || 0);
                        return (
                          <button
                            type="button"
                            key={i}
                            onClick={() => toggleFecha(c.iso)}
                            disabled={limiteAlcanzado}
                            style={{
                              padding: '6px 0', fontSize: '10px', borderRadius: '4px',
                              border: '1px solid ' + (seleccionado ? 'var(--brand-navy)' : 'var(--border-light)'),
                              background: seleccionado ? 'var(--brand-navy)' : '#fff',
                              color: seleccionado ? '#fff' : 'var(--text-primary)',
                              cursor: limiteAlcanzado ? 'not-allowed' : 'pointer',
                              opacity: limiteAlcanzado ? 0.4 : 1,
                              fontWeight: seleccionado ? 'bold' : 'normal'
                            }}
                          >
                            {c.dia}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{
                      fontSize: '10px', fontWeight: 'bold',
                      color: form.fechasSuspension.length === form.diasSuspension ? 'var(--green-dark)' : 'var(--brand-red)'
                    }}>
                      Seleccionados {form.fechasSuspension.length} de {form.diasSuspension}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-industrial-primary"
              disabled={suspensionIncompleta || guardando}
              style={{ marginTop: '6px', opacity: (suspensionIncompleta || guardando) ? 0.5 : 1, cursor: (suspensionIncompleta || guardando) ? 'not-allowed' : 'pointer' }}
            >
              <Plus size={16} /> {guardando ? 'Guardando…' : 'Guardar Incidencia'}
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
            <div className="sec-title" style={{ color: 'var(--text-secondary)' }}>Días de Suspensión Acumulados</div>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--brand-red)', marginTop: '4px' }}>
              {diasSuspensionAcumulados} <span style={{ fontSize: '16px' }}>días</span>
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
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Suspensión</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Observaciones</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {incidencias.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
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
                          {ETIQUETA_INCIDENCIA[inc.tipo] || inc.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'normal' }}>
                        {inc.suspension && inc.fechasSuspension?.length ? inc.fechasSuspension.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'normal' }}>
                        {inc.observaciones || '—'}
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
