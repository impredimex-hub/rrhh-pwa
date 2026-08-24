import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, ChevronLeft, ChevronRight, SlidersHorizontal, Check } from 'lucide-react';
import type { Colaborador, CursoCapacitacion } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { subscribeCursos } from '../services/capacitacionService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const CursosModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  
  // Filtros de búsqueda
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');
  const [filtroPuesto, setFiltroPuesto] = useState('');
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  // Selector de visibilidad de columnas
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>({});
  const [menuColumnasAbierto, setMenuColumnasAbierto] = useState(false);

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    const unsubCursos = subscribeCursos((data) => setCursos(data));
    return () => {
      unsubColab();
      unsubCursos();
    };
  }, []);

  // Inicializar visibilidad de columnas cuando cambien los cursos
  useEffect(() => {
    const columnasBase: Record<string, boolean> = {
      noNomina: true,
      nombre: true,
      departamento: true,
      puesto: true,
      estatus: true
    };
    cursos.forEach(curso => {
      if (curso.id) {
        columnasBase[`curso_${curso.id}`] = true;
        columnasBase[`fecha_${curso.id}`] = true;
      }
    });
    setColumnasVisibles(prev => ({ ...columnasBase, ...prev }));
  }, [cursos]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroTexto, filtroDepto, filtroPuesto]);

  // Departamentos y puestos disponibles para los dropdowns
  const departamentosDisponibles = Array.from(
    new Set(colaboradores.map(c => (c.departamento || '').trim().toUpperCase()).filter(Boolean))
  ).sort();

  const puestosDisponibles = Array.from(
    new Set(
      colaboradores
        .filter(c => !filtroDepto || (c.departamento || '').trim().toUpperCase() === filtroDepto)
        .map(c => (c.puesto || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();

  // Calcular duración en horas entre dos horarios
  const calcularDuracion = (hInicio?: string, hFin?: string): string => {
    if (!hInicio || !hFin) return '1h';
    const [h1, m1] = hInicio.split(':').map(Number);
    const [h2, m2] = hFin.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return '1h';
    const min1 = h1 * 60 + (m1 || 0);
    const min2 = h2 * 60 + (m2 || 0);
    const diff = min2 - min1;
    if (diff <= 0) return '1h';
    const horas = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
  };

  // Determinar si un colaborador está asignado a un curso
  const estaAsignado = (colab: Colaborador, curso: CursoCapacitacion): boolean => {
    const depto = (colab.departamento || '').toUpperCase().trim();
    const puesto = (colab.puesto || '').toUpperCase().trim();

    const deptosObj = (curso.departamentosObjetivo || []).map(d => d.toUpperCase().trim());
    const puestosObj = (curso.puestosObjetivo || []).map(p => p.toUpperCase().trim());

    const deptoCoincide = deptosObj.includes('TODOS') || deptosObj.includes('GENERAL') || deptosObj.includes(depto);
    const puestoCoincide = puestosObj.length === 0 || puestosObj.includes(puesto);

    return deptoCoincide && puestoCoincide;
  };

  // Obtener estado: 'Programado' o 'No asistencia'
  const obtenerEstadoCurso = (colab: Colaborador, curso: CursoCapacitacion): 'Programado' | 'No asistencia' | null => {
    if (!estaAsignado(colab, curso)) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaFinCurso = new Date(curso.fechaFin);
    fechaFinCurso.setHours(23, 59, 59, 999);

    // Si ya pasó la fecha compromiso
    if (hoy > fechaFinCurso || curso.estatus === 'FINALIZADO') {
      return 'No asistencia';
    }

    return 'Programado';
  };

  const toggleColumna = (key: string) => {
    setColumnasVisibles(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filtrado de la plantilla
  const listaFiltrada = colaboradores.filter(c => {
    const coincideTexto = 
      c.nombreCompleto.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      c.noNomina.toLowerCase().includes(filtroTexto.toLowerCase());

    const coincideDepto = !filtroDepto || (c.departamento || '').trim().toUpperCase() === filtroDepto;
    const coincidePuesto = !filtroPuesto || (c.puesto || '').trim().toUpperCase() === filtroPuesto;

    return coincideTexto && coincideDepto && coincidePuesto;
  });

  const totalPaginas = Math.ceil(listaFiltrada.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = listaFiltrada.slice(indexInicio, indexInicio + elementosPorPagina);

  const handleExportExcel = () => {
    const data = listaFiltrada.map(c => {
      const rowData: Record<string, any> = {
        '# NOMINA': c.noNomina,
        'NOMBRE': c.nombreCompleto,
        'DEPARTAMENTO': c.departamento || '-',
        'PUESTO': c.puesto || '-',
      };

      cursos.forEach(curso => {
        const est = obtenerEstadoCurso(c, curso);
        rowData[curso.titulo] = est || '-';
        rowData[`FECHA ${curso.titulo}`] = `${curso.fechaInicio} | ${curso.horaInicio || '09:00'}-${curso.horaFin || '10:00'} (${calcularDuracion(curso.horaInicio, curso.horaFin)})`;
      });

      rowData['ESTATUS'] = c.estatus;
      return rowData;
    });

    exportToExcel(data, 'IMPREDIMEX_Matriz_Cursos');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Nombre', 'Departamento', 'Puesto', ...cursos.map(c => c.titulo), 'Estatus'];
    const rows = listaFiltrada.map(c => [
      c.noNomina,
      c.nombreCompleto,
      c.departamento || '-',
      c.puesto || '-',
      ...cursos.map(cur => obtenerEstadoCurso(c, cur) || '-'),
      c.estatus
    ]);
    exportToPDF('IMPREDIMEX — Asignación de Cursos por Colaborador', headers, rows, 'Matriz_Cursos');
  };

  return (
    <div>
      <div className="card-industrial">
        
        {/* Encabezado y Barra de Filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Control de Cursos Asignados por Colaborador ({colaboradores.length})</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Filtro Texto */}
            <input
              type="text" placeholder="Buscar colaborador…"
              value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)}
              style={{ width: '130px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
            />

            {/* Filtro Departamento */}
            <select
              value={filtroDepto}
              onChange={(e) => {
                setFiltroDepto(e.target.value);
                setFiltroPuesto('');
              }}
              style={{ width: '130px', height: '30px', padding: '2px 6px', fontSize: '10px' }}
            >
              <option value="">Todos los Deptos</option>
              {departamentosDisponibles.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Filtro Puesto */}
            <select
              value={filtroPuesto}
              onChange={(e) => setFiltroPuesto(e.target.value)}
              style={{ width: '130px', height: '30px', padding: '2px 6px', fontSize: '10px' }}
            >
              <option value="">Todos los Puestos</option>
              {puestosDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Botón Selector de Columnas */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuColumnasAbierto(!menuColumnasAbierto)}
                className="btn-industrial-primary"
                style={{ height: '30px', padding: '4px 8px', fontSize: '10px', width: 'auto' }}
                title="Configurar columnas visibles"
              >
                <SlidersHorizontal size={13} /> Columnas
              </button>

              {menuColumnasAbierto && (
                <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#fff', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', width: '220px', maxHeight: '250px', overflowY: 'auto', padding: '8px', marginTop: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '6px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                    VISIBILIDAD DE COLUMNAS
                  </div>

                  {/* Columnas fijas */}
                  {[
                    { key: 'noNomina', label: '# Nómina' },
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'departamento', label: 'Departamento' },
                    { key: 'puesto', label: 'Puesto' },
                    { key: 'estatus', label: 'Estatus' },
                  ].map(col => (
                    <div
                      key={col.key}
                      onClick={() => toggleColumna(col.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      <div style={{ width: '12px', height: '12px', border: '1px solid var(--brand-navy)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: columnasVisibles[col.key] !== false ? 'var(--brand-navy)' : '#fff' }}>
                        {columnasVisibles[col.key] !== false && <Check size={9} color="#fff" />}
                      </div>
                      {col.label}
                    </div>
                  ))}

                  {/* Columnas dinámicas de cursos */}
                  {cursos.map(cur => (
                    <React.Fragment key={cur.id}>
                      <div
                        onClick={() => cur.id && toggleColumna(`curso_${cur.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        <div style={{ width: '12px', height: '12px', border: '1px solid var(--brand-navy)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: columnasVisibles[`curso_${cur.id}`] !== false ? 'var(--brand-navy)' : '#fff' }}>
                          {columnasVisibles[`curso_${cur.id}`] !== false && <Check size={9} color="#fff" />}
                        </div>
                        Curso: {cur.titulo}
                      </div>

                      <div
                        onClick={() => cur.id && toggleColumna(`fecha_${cur.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 4px 4px 16px', fontSize: '9.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <div style={{ width: '12px', height: '12px', border: '1px solid var(--border-mid)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: columnasVisibles[`fecha_${cur.id}`] !== false ? 'var(--brand-navy)' : '#fff' }}>
                          {columnasVisibles[`fecha_${cur.id}`] !== false && <Check size={9} color="#fff" />}
                        </div>
                        Fecha: {cur.titulo}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleExportExcel} className="btn-industrial-success" style={{ height: '30px' }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn-industrial-danger" style={{ height: '30px' }}>
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>

        {/* Tabla Dinámica con Cursos y Fechas */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {columnasVisibles.noNomina !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>}
                {columnasVisibles.nombre !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>}
                {columnasVisibles.departamento !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>}
                {columnasVisibles.puesto !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>}

                {/* Encabezados Dinámicos por Curso */}
                {cursos.map(cur => (
                  <React.Fragment key={cur.id}>
                    {columnasVisibles[`curso_${cur.id}`] !== false && (
                      <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', background: 'rgba(0,32,96,0.03)' }}>
                        {cur.titulo}
                      </th>
                    )}
                    {columnasVisibles[`fecha_${cur.id}`] !== false && (
                      <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: '#5A6A80', textTransform: 'uppercase', background: 'rgba(0,32,96,0.01)' }}>
                        Fecha ({cur.titulo})
                      </th>
                    )}
                  </React.Fragment>
                ))}

                {columnasVisibles.estatus !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>}
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={5 + cursos.length * 2} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Sin registros que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                colaboradoresPaginados.map((colab) => (
                  <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    
                    {columnasVisibles.noNomina !== false && (
                      <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                    )}

                    {columnasVisibles.nombre !== false && (
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                    )}

                    {columnasVisibles.departamento !== false && (
                      <td style={{ padding: '5px 8px' }}>
                        {colab.departamento ? (
                          <span style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                            {colab.departamento}
                          </span>
                        ) : '-'}
                      </td>
                    )}

                    {columnasVisibles.puesto !== false && (
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                    )}

                    {/* Celdas dinámicas por curso */}
                    {cursos.map(cur => {
                      const est = obtenerEstadoCurso(colab, cur);
                      const duracion = calcularDuracion(cur.horaInicio, cur.horaFin);

                      return (
                        <React.Fragment key={cur.id}>
                          {columnasVisibles[`curso_${cur.id}`] !== false && (
                            <td style={{ padding: '5px 8px', textAlign: 'center', background: 'rgba(0,32,96,0.02)' }}>
                              {est === 'Programado' ? (
                                <span style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8px', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                  Programado
                                </span>
                              ) : est === 'No asistencia' ? (
                                <span style={{ display: 'inline-block', background: 'var(--red-light)', color: 'var(--brand-red)', fontSize: '8px', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                  No asistencia
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-light)', fontSize: '9px' }}>-</span>
                              )}
                            </td>
                          )}

                          {columnasVisibles[`fecha_${cur.id}`] !== false && (
                            <td style={{ padding: '5px 8px', fontSize: '8.5px', color: 'var(--text-secondary)' }}>
                              {est ? (
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--brand-navy-dark)' }}>{cur.fechaInicio}</div>
                                  <div style={{ fontSize: '8px', color: 'var(--text-light)' }}>
                                    {cur.horaInicio || '09:00'} - {cur.horaFin || '10:00'} ({duracion})
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-light)' }}>-</span>
                              )}
                            </td>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {columnasVisibles.estatus !== false && (
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ display: 'inline-block', background: colab.estatus === 'ACTIVO' ? 'var(--green-light)' : 'var(--red-light)', color: colab.estatus === 'ACTIVO' ? 'var(--green-dark)' : 'var(--brand-red)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                          {colab.estatus}
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
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
