import React, { useState, useEffect } from 'react';
import { Award, Briefcase, Plus, Trash2, Calendar } from 'lucide-react';
import type { Colaborador, Vacante } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeVacantes, saveVacante, deleteVacante } from '../services/vacanteService';

export const AntiguedadVacantesModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [filtro, setFiltro] = useState('');

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

    const req = Number(formVacante.cantidadRequerida);
    const cub = Number(formVacante.cantidadCubierta);
    const estatusCalculado: 'ABIERTA' | 'EN_PROCESO' | 'CUBIERTA' = 
      cub >= req ? 'CUBIERTA' : cub > 0 ? 'EN_PROCESO' : 'ABIERTA';

    saveVacante({
      ...formVacante,
      puesto: formVacante.puesto.toUpperCase(),
      departamento: formVacante.departamento.toUpperCase(),
      cantidadRequerida: req,
      cantidadCubierta: cub,
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

  const listaFiltrada = colaboradores.filter(c =>
    c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
    c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase()))
  );

  return (
    <div>
      {/* SECCIÓN 1: CONTROL DE ANTIGÜEDAD (Tipografía Reducida al 50% / Compacta) */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Control de Antigüedad y Aniversarios</div>
          </div>
          <input
            type="text" placeholder="Buscar colaborador…"
            value={filtro} onChange={(e) => setFiltro(e.target.value)}
            style={{ width: '220px', padding: '4px 8px', fontSize: '10px' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Ingreso</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Antigüedad</th>
                <th style={{ padding: '5px 6px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Alerta de Aniversario</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    No hay colaboradores registrados.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((colab) => {
                  const { anios, meses, esAniversarioMes } = calcularAntiguedad(colab.fechaIngreso);
                  return (
                    <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                      <td style={{ padding: '4px 6px' }}>{colab.departamento || '-'}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{colab.fechaIngreso || '-'}</td>
                      <td style={{ padding: '4px 6px', fontWeight: 600, color: 'var(--brand-navy-dark)' }}>
                        {anios} a, {meses} m
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        {esAniversarioMes ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--orange-light)', color: '#7A4500', padding: '2px 5px', borderRadius: '3px', fontSize: '8.5px', fontWeight: 'bold' }}>
                            <Calendar size={10} /> Aniversario ({anios} años)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: '8.5px' }}>Sin evento cercano</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* Formulario */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Abrir Nueva Vacante</div>
          </div>
          <form onSubmit={handleCrearVacante} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text" placeholder="Departamento (ej. FLEXOGRAFÍA)" required value={formVacante.departamento}
              onChange={(e) => setFormVacante({ ...formVacante, departamento: e.target.value })}
            />
            <input
              type="text" placeholder="Puesto (ej. AYUDANTE GENERAL)" required value={formVacante.puesto}
              onChange={(e) => setFormVacante({ ...formVacante, puesto: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>REQUERIDAS</label>
                <input
                  type="number" min="1" required value={formVacante.cantidadRequerida}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadRequerida: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>CUBIERTAS</label>
                <input
                  type="number" min="0" required value={formVacante.cantidadCubierta}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadCubierta: Number(e.target.value) })}
                />
              </div>
            </div>
            <button type="submit" className="btn-industrial-primary" style={{ width: '100%', marginTop: '6px' }}>
              <Plus size={16} /> Registrar Vacante
            </button>
          </form>
        </div>

        {/* Tablero */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Estado de Plazas ({vacantes.length})</div>
          </div>
          {vacantes.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '2rem 0' }}>
              No hay vacantes abiertas actualmente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vacantes.map((v) => {
                const badgeCls = 
                  v.estatus === 'CUBIERTA' ? 'badge-ok' :
                  v.estatus === 'EN_PROCESO' ? 'badge-warn' : 'badge-nok';

                return (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--brand-navy-dark)', fontSize: '13px' }}>{v.puesto}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{v.departamento} • {v.cantidadCubierta}/{v.cantidadRequerida} plazas</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge-industrial ${badgeCls}`}>
                        {v.estatus}
                      </span>
                      <button
                        onClick={() => v.id && deleteVacante(v.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '4px' }}
                        title="Eliminar vacante"
                      >
                        <Trash2 size={15} />
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
  );
};
