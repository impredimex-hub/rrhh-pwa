import React, { useState, useEffect } from 'react';
import { BookOpen, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Colaborador, CursoCapacitacion } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeCursos } from '../services/capacitacionService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const CursosModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  const [filtro, setFiltro] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubCursos = subscribeCursos((data) => setCursos(data));
    return () => {
      unsubColab();
      unsubCursos();
    };
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  // Asignar cursos correspondientes al colaborador según su departamento y puesto
  const obtenerCursosAsignados = (colab: Colaborador): CursoCapacitacion[] => {
    const depto = (colab.departamento || '').toUpperCase().trim();
    const puesto = (colab.puesto || '').toUpperCase().trim();

    return cursos.filter(c => {
      const deptosObj = (c.departamentosObjetivo || []).map(d => d.toUpperCase().trim());
      const puestosObj = (c.puestosObjetivo || []).map(p => p.toUpperCase().trim());

      const deptoCoincide = deptosObj.includes('TODOS') || deptosObj.includes('GENERAL') || deptosObj.includes(depto);
      
      // Si el curso especificó puestos objetivo, debe coincidir el puesto; si no especificó, aplica a todo el departamento
      const puestoCoincide = puestosObj.length === 0 || puestosObj.includes(puesto);

      return deptoCoincide && puestoCoincide;
    });
  };

  const listaFiltrada = colaboradores.filter(c =>
    c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
    c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase())) ||
    (c.puesto && c.puesto.toLowerCase().includes(filtro.toLowerCase()))
  );

  const totalPaginas = Math.ceil(listaFiltrada.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = listaFiltrada.slice(indexInicio, indexInicio + elementosPorPagina);

  const handleExportExcel = () => {
    const data = colaboradores.map(c => {
      const asignados = obtenerCursosAsignados(c);
      return {
        '# NOMINA': c.noNomina,
        'NOMBRE': c.nombreCompleto,
        'DEPARTAMENTO': c.departamento || '-',
        'PUESTO': c.puesto || '-',
        'CURSOS ASIGNADOS': asignados.length > 0 ? asignados.map(cur => `${cur.titulo} (${cur.estatus})`).join(' | ') : 'Sin cursos asignados',
        'TOTAL CURSOS': asignados.length,
        'ESTATUS': c.estatus
      };
    });
    exportToExcel(data, 'IMPREDIMEX_Asignacion_Cursos');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Nombre', 'Departamento', 'Puesto', 'Cursos Asignados', 'Total'];
    const rows = colaboradores.map(c => {
      const asignados = obtenerCursosAsignados(c);
      return [
        c.noNomina,
        c.nombreCompleto,
        c.departamento || '-',
        c.puesto || '-',
        asignados.length > 0 ? asignados.map(cur => cur.titulo).join(', ') : 'Sin asignar',
        asignados.length
      ];
    });
    exportToPDF('IMPREDIMEX — Asignación de Cursos por Colaborador', headers, rows, 'Asignacion_Cursos');
  };

  return (
    <div>
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Control de Cursos Asignados por Colaborador ({colaboradores.length})</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Buscar colaborador…"
              value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ width: '160px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
            />
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
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Cursos Asignados</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Sin registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                colaboradoresPaginados.map((colab) => {
                  const cursosAsignados = obtenerCursosAsignados(colab);
                  return (
                    <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {colab.departamento ? (
                          <span style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                            {colab.departamento}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {cursosAsignados.length === 0 ? (
                          <span style={{ color: 'var(--text-light)', fontSize: '8.5px', fontStyle: 'italic' }}>Sin cursos asignados</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {cursosAsignados.map((curso, idx) => {
                              const badgeBg = curso.estatus === 'FINALIZADO' ? 'var(--green-light)' : curso.estatus === 'EN_CURSO' ? 'var(--orange-light)' : 'var(--brand-navy-light)';
                              const badgeColor = curso.estatus === 'FINALIZADO' ? 'var(--green-dark)' : curso.estatus === 'EN_CURSO' ? '#7A4500' : 'var(--brand-navy)';
                              return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--brand-navy-dark)' }}>• {curso.titulo}</span>
                                  <span style={{ background: badgeBg, color: badgeColor, fontSize: '7.5px', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                                    {curso.estatus}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ display: 'inline-block', background: colab.estatus === 'ACTIVO' ? 'var(--green-light)' : 'var(--red-light)', color: colab.estatus === 'ACTIVO' ? 'var(--green-dark)' : 'var(--brand-red)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                          {colab.estatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-light)', fontSize: '10px', color: 'var(--text-secondary)' }}>
            <div>
              Mostrando {indexInicio + 1} - {Math.min(indexInicio + elementosPorPagina, listaFiltrada.length)} de {listaFiltrada.length}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-mid)', background: paginaActual === 1 ? '#f1f5f9' : '#fff', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', fontSize: '10px', color: 'var(--text-primary)' }}
              >
                <ChevronLeft size={12} /> Anterior
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--brand-navy)' }}>
                {paginaActual} / {totalPaginas}
              </span>
              <button
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-mid)', background: paginaActual === totalPaginas ? '#f1f5f9' : '#fff', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', fontSize: '10px', color: 'var(--text-primary)' }}
              >
                Siguiente <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
