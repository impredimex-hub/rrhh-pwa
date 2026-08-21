import React, { useState, useEffect } from 'react';
import { Award, Briefcase, Plus, Trash2, Calendar } from 'lucide-react';
import type { Colaborador, Vacante } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeVacantes, saveVacante, deleteVacante } from '../services/vacanteService';

export const AntiguedadVacantesModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [vacantes, setVacantes] = useState<Vacante[]>([]);

  const [formVacante, setFormVacante] = useState<Vacante>({
    puesto: '',
    departamento: '',
    cantidadRequerida: 1,
    cantidadCubierta: 0,
    estatus: 'ABIERTA',
    fechaCreacion: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubVac = subscribeVacantes((data) => setVacantes(data));
    return () => {
      unsubColab();
      unsubVac();
    };
  }, []);

  const calcularAntiguedad = (fechaIngresoStr?: string) => {
    if (!fechaIngresoStr) return { anios: 0, meses: 0, esAniversarioMes: false };
    const hoy = new Date();
    const ingreso = new Date(fechaIngresoStr);
    
    if (isNaN(ingreso.getTime())) return { anios: 0, meses: 0, esAniversarioMes: false };

    let anios = hoy.getFullYear() - ingreso.getFullYear();
    let meses = hoy.getMonth() - ingreso.getMonth();

    if (meses < 0 || (meses === 0 && hoy.getDate() < ingreso.getDate())) {
      anios--;
      meses += 12;
    }

    const esAniversarioMes = hoy.getMonth() === ingreso.getMonth() && anios > 0;
    return { anios, meses, esAniversarioMes };
  };

  const handleCrearVacante = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVacante.puesto.trim() || !formVacante.departamento.trim()) return;

    const estatusCalculado: 'ABIERTA' | 'EN_PROCESO' | 'CUBIERTA' = 
      Number(formVacante.cantidadCubierta) >= Number(formVacante.cantidadRequerida) ? 'CUBIERTA' :
      Number(formVacante.cantidadCubierta) > 0 ? 'EN_PROCESO' : 'ABIERTA';

    saveVacante({
      ...formVacante,
      cantidadRequerida: Number(formVacante.cantidadRequerida),
      cantidadCubierta: Number(formVacante.cantidadCubierta),
      estatus: estatusCalculado
    });

    setFormVacante({
      puesto: '',
      departamento: '',
      cantidadRequerida: 1,
      cantidadCubierta: 0,
      estatus: 'ABIERTA',
      fechaCreacion: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* SECCIÓN 1: CONTROL DE ANTIGÜEDAD */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #eaeaea', paddingBottom: '10px', color: '#1a1a1a' }}>
          <Award size={24} color="#d97706" /> Control de Antigüedad y Aniversarios
        </h2>

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e0e0e0', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Nómina</th>
                <th style={{ padding: '10px' }}>Nombre</th>
                <th style={{ padding: '10px' }}>Departamento</th>
                <th style={{ padding: '10px' }}>Puesto</th>
                <th style={{ padding: '10px' }}>Fecha Ingreso</th>
                <th style={{ padding: '10px' }}>Antigüedad</th>
                <th style={{ padding: '10px' }}>Alerta de Aniversario</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay colaboradores en el directorio.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => {
                  const { anios, meses, esAniversarioMes } = calcularAntiguedad(colab.fechaIngreso);
                  return (
                    <tr key={colab.noNomina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{colab.noNomina}</td>
                      <td style={{ padding: '10px' }}>{colab.nombreCompleto}</td>
                      <td style={{ padding: '10px' }}>{colab.departamento}</td>
                      <td style={{ padding: '10px' }}>{colab.puesto}</td>
                      <td style={{ padding: '10px' }}>{colab.fechaIngreso || '-'}</td>
                      <td style={{ padding: '10px', fontWeight: '500' }}>
                        {anios} años, {meses} meses
                      </td>
                      <td style={{ padding: '10px' }}>
                        {esAniversarioMes ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            <Calendar size={14} /> Aniversario este mes ({anios} años)
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Sin evento cercano</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 2: CONTROL DE VACANTES */}
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #eaeaea', paddingBottom: '10px', color: '#1a1a1a' }}>
          <Briefcase size={24} color="#2563eb" /> Tablero de Vacantes por Departamento
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '16px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> Abrir Nueva Vacante
            </h3>
            <form onSubmit={handleCrearVacante} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text" placeholder="Departamento (ej. Impresión)" required value={formVacante.departamento}
                onChange={(e) => setFormVacante({ ...formVacante, departamento: e.target.value })}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
              <input
                type="text" placeholder="Puesto (ej. Ayudante General)" required value={formVacante.puesto}
                onChange={(e) => setFormVacante({ ...formVacante, puesto: e.target.value })}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Requeridas</label>
                  <input
                    type="number" min="1" required value={formVacante.cantidadRequerida}
                    onChange={(e) => setFormVacante({ ...formVacante, cantidadRequerida: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Cubiertas</label>
                  <input
                    type="number" min="0" required value={formVacante.cantidadCubierta}
                    onChange={(e) => setFormVacante({ ...formVacante, cantidadCubierta: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                style={{ padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Registrar Vacante
              </button>
            </form>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Estado de Plazas ({vacantes.length})</h3>
            {vacantes.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                No hay vacantes abiertas actualmente.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vacantes.map((v) => {
                  const colorBadge = 
                    v.estatus === 'CUBIERTA' ? { bg: '#dcfce7', text: '#15803d' } :
                    v.estatus === 'EN_PROCESO' ? { bg: '#fef3c7', text: '#b45309' } :
                    { bg: '#fee2e2', text: '#b91c1c' };

                  return (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{v.puesto}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{v.departamento} • {v.cantidadCubierta}/{v.cantidadRequerida} plazas</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: colorBadge.bg, color: colorBadge.text }}>
                          {v.estatus}
                        </span>
                        <button
                          onClick={() => v.id && deleteVacante(v.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                          title="Eliminar vacante"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
