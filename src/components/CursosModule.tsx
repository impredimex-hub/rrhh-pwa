import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, ChevronLeft, ChevronRight, SlidersHorizontal, Check, Filter, X, RefreshCw, Undo2 } from 'lucide-react';
import type { Colaborador, CursoCapacitacion, RegistroCursoCompletado } from '../types/rrhh';
import { CALIFICACION_MIN, CALIFICACION_MAX } from '../types/rrhh';
import { subscribeColaboradores, ordenarPorNomina } from '../services/personalService';
import { subscribeCursos } from '../services/capacitacionService';
import { subscribeCompletados, guardarCompletados, guardarCalificacion, quitarCompletado } from '../services/cursoCompletadoService';
import { usePermisos, useSesion } from '../services/SesionContext';
import { hoyISO } from '../utils/fechas';
import { exportToExcel, exportToPDF, exportToExcelSheets, exportToPDFSections } from '../utils/exportUtils';

/** Los tres botones de acción de la barra: redondos, solo icono, 30 px. */
const BOTON_REDONDO: React.CSSProperties = {
  width: '30px',
  height: '30px',
  minWidth: '30px',
  padding: 0,
  border: 'none',
  borderRadius: '50%',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

export const CursosModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  
  // Filtros de búsqueda
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');
  const [filtroPuesto, setFiltroPuesto] = useState('');
  const [filtroCurso, setFiltroCurso] = useState(''); // ID del curso seleccionado

  /**
   * Filtros efectivamente aplicados, distintos de los que se están capturando
   * arriba. `null` significa que todavía no se ha pulsado Filtrar y por eso no
   * se muestra ninguna tabla: con 122 personas, abrir la pestaña y recibir el
   * padrón completo no ayudaba a nadie.
   *
   * Aplicar sin llenar nada devuelve a todos, que es la salida deliberada para
   * ver el listado completo.
   */
  const [aplicados, setAplicados] = useState<null | {
    texto: string; depto: string; puesto: string; curso: string;
  }>(null);
  
  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  // Selector de visibilidad de columnas
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>({});
  const [menuColumnasAbierto, setMenuColumnasAbierto] = useState(false);

  /* ── Quién ya cursó (SPEC-028) ──────────────────────────────────────────
     Marcar y guardar son dos momentos distintos: las casillas viven aquí, en
     pantalla, y solo se escriben al pulsar Actualizar. Así una sesión de
     treinta personas cuesta **una** escritura, no treinta, y quien se
     equivoca de casilla puede desmarcarla sin que haya pasado nada. */
  const [completados, setCompletados] = useState<Record<string, RegistroCursoCompletado>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [califs, setCalifs] = useState<Record<string, string>>({});
  const [guardandoCursado, setGuardandoCursado] = useState(false);
  const { puedeCapturar } = usePermisos();
  const sesion = useSesion();

  /** Curso sobre el que se está trabajando. Sin uno elegido no hay qué marcar. */
  const cursoActivo = aplicados?.curso ? cursos.find(c => c.id === aplicados.curso) || null : null;

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(ordenarPorNomina(data)));
    const unsubCursos = subscribeCursos((data) => setCursos(data));
    return () => {
      unsubColab();
      unsubCursos();
    };
  }, []);

  // Inicializar columnas visibles por defecto
  useEffect(() => {
    const columnasBase: Record<string, boolean> = {
      noNomina: true,
      nombre: true,
      puesto: true
    };
    cursos.forEach(curso => {
      if (curso.id) {
        columnasBase[`curso_${curso.id}`] = true;
        columnasBase[`fecha_${curso.id}`] = true;
      }
    });
    setColumnasVisibles(prev => ({ ...columnasBase, ...prev }));
  }, [cursos]);

  // Cuando se selecciona un curso específico en el filtro:
  // Se ocultan las columnas de los otros cursos y se muestran solo las del curso elegido
  useEffect(() => {
    if (filtroCurso) {
      setColumnasVisibles(prev => {
        const nuevo: Record<string, boolean> = { ...prev };
        cursos.forEach(cur => {
          if (cur.id) {
            const esSeleccionado = cur.id === filtroCurso;
            nuevo[`curso_${cur.id}`] = esSeleccionado;
            nuevo[`fecha_${cur.id}`] = esSeleccionado;
          }
        });
        return nuevo;
      });
    } else {
      // Si se selecciona "Todos los Cursos", se reactivan todas las columnas de cursos
      setColumnasVisibles(prev => {
        const nuevo: Record<string, boolean> = { ...prev };
        cursos.forEach(cur => {
          if (cur.id) {
            nuevo[`curso_${cur.id}`] = true;
            nuevo[`fecha_${cur.id}`] = true;
          }
        });
        return nuevo;
      });
    }
  }, [filtroCurso, cursos]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroTexto, filtroDepto, filtroPuesto, filtroCurso]);

  // Solo se lee el curso filtrado, y solo mientras está filtrado: un documento
  // de unos 7 KB en lugar de la colección entera.
  useEffect(() => {
    if (!cursoActivo?.id) { setCompletados({}); setMarcados({}); setCalifs({}); return; }
    setMarcados({});
    setCalifs({});
    const unsub = subscribeCompletados(cursoActivo.id, setCompletados);
    return () => unsub();
  }, [cursoActivo?.id]);

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

  const estaAsignado = (colab: Colaborador, curso: CursoCapacitacion): boolean => {
    const depto = (colab.departamento || '').toUpperCase().trim();
    const puesto = (colab.puesto || '').toUpperCase().trim();

    const deptosObj = (curso.departamentosObjetivo || []).map(d => d.toUpperCase().trim());
    const puestosObj = (curso.puestosObjetivo || []).map(p => p.toUpperCase().trim());

    const deptoCoincide = deptosObj.includes('TODOS') || deptosObj.includes('GENERAL') || deptosObj.includes(depto);
    const puestoCoincide = puestosObj.length === 0 || puestosObj.includes(puesto);

    return deptoCoincide && puestoCoincide;
  };

  const obtenerEstadoCurso = (colab: Colaborador, curso: CursoCapacitacion): 'Programado' | 'No asistencia' | null => {
    if (!estaAsignado(colab, curso)) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaFinCurso = new Date(curso.fechaFin);
    fechaFinCurso.setHours(23, 59, 59, 999);

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

  // Filtrado compuesto con ordenamiento numérico. Se apoya en `aplicados`, no
  // en lo que se está escribiendo: la tabla solo cambia al pulsar Filtrar.
  const listaFiltrada = !aplicados ? [] : ordenarPorNomina(
    colaboradores.filter(c => {
      const coincideTexto =
        c.nombreCompleto.toLowerCase().includes(aplicados.texto.toLowerCase()) ||
        c.noNomina.toLowerCase().includes(aplicados.texto.toLowerCase());

      const coincideDepto = !aplicados.depto || (c.departamento || '').trim().toUpperCase() === aplicados.depto;
      const coincidePuesto = !aplicados.puesto || (c.puesto || '').trim().toUpperCase() === aplicados.puesto;

      // Si hay un filtro de curso activo, solo incluir colaboradores asignados a ese curso
      let coincideCurso = true;
      if (aplicados.curso) {
        const cursoSeleccionado = cursos.find(cur => cur.id === aplicados.curso);
        if (cursoSeleccionado) {
          coincideCurso = estaAsignado(c, cursoSeleccionado);
        }
      }

      return coincideTexto && coincideDepto && coincidePuesto && coincideCurso;
    })
  );

  const aplicarFiltros = () => {
    setAplicados({ texto: filtroTexto, depto: filtroDepto, puesto: filtroPuesto, curso: filtroCurso });
    setPaginaActual(1);
  };

  const limpiarFiltros = () => {
    setFiltroTexto(''); setFiltroDepto(''); setFiltroPuesto(''); setFiltroCurso('');
    setAplicados(null);
    setPaginaActual(1);
  };

  /**
   * La tabla de arriba son los **pendientes**: quien ya está en completados
   * sale de ella y aparece abajo (SPEC-028). Sin curso filtrado no hay a quién
   * dar por cursado, así que se muestran todos.
   */
  const pendientes = cursoActivo
    ? listaFiltrada.filter(c => !completados[c.noNomina])
    : listaFiltrada;

  /** Quienes ya cursaron, en el orden del padrón y con sus datos al día. */
  const listaCompletados = cursoActivo
    ? ordenarPorNomina(colaboradores.filter(c => !!completados[c.noNomina]))
    : [];

  const cuantosMarcados = Object.values(marcados).filter(Boolean).length;

  const alternarMarcado = (nomina: string) => {
    if (!puedeCapturar) return;
    setMarcados(prev => ({ ...prev, [nomina]: !prev[nomina] }));
  };

  /** Una calificación válida, o `undefined` si el campo va vacío. */
  const leerCalif = (valor: string): number | undefined => {
    const v = (valor || '').trim();
    if (!v) return undefined;
    const n = Number(v);
    if (isNaN(n) || n < CALIFICACION_MIN || n > CALIFICACION_MAX) return undefined;
    return n;
  };

  const actualizarCursados = async () => {
    if (!cursoActivo?.id || !puedeCapturar || guardandoCursado) return;

    const nuevos: Record<string, RegistroCursoCompletado> = {};
    Object.entries(marcados).forEach(([nomina, marcado]) => {
      if (!marcado) return;
      nuevos[nomina] = {
        fecha: hoyISO(),
        calificacion: leerCalif(califs[nomina]),
        porNomina: sesion?.nomina || '',
        porNombre: sesion?.nombre || ''
      };
    });

    if (Object.keys(nuevos).length === 0) {
      alert('No hay nadie marcado. Palomea la casilla Cursado de quienes tomaron el curso.');
      return;
    }

    // Una calificación fuera de rango se guardaría como vacía sin avisar; más
    // vale detenerse que dar por buena una captura que se va a perder.
    const malas = Object.entries(marcados)
      .filter(([n, m]) => m && (califs[n] || '').trim() && leerCalif(califs[n]) === undefined)
      .map(([n]) => n);
    if (malas.length) {
      alert(`Hay calificaciones fuera de ${CALIFICACION_MIN} a ${CALIFICACION_MAX} en las nóminas: ${malas.join(', ')}.`);
      return;
    }

    setGuardandoCursado(true);
    try {
      await guardarCompletados(cursoActivo.id, nuevos);
      setMarcados({});
      setCalifs({});
      setPaginaActual(1);
    } catch (err: any) {
      alert('No se pudo guardar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setGuardandoCursado(false);
    }
  };

  const cambiarCalifCompletado = async (nomina: string, valor: string) => {
    if (!cursoActivo?.id || !puedeCapturar) return;
    const v = (valor || '').trim();
    if (v && leerCalif(v) === undefined) {
      alert(`La calificación debe ir de ${CALIFICACION_MIN} a ${CALIFICACION_MAX}.`);
      return;
    }
    try {
      await guardarCalificacion(cursoActivo.id, nomina, leerCalif(v));
    } catch (err: any) {
      alert('No se pudo guardar la calificación: ' + (err?.message || 'Error desconocido'));
    }
  };

  const regresarAPendientes = async (colab: Colaborador) => {
    if (!cursoActivo?.id || !puedeCapturar) return;
    if (!confirm(`¿Regresar a ${colab.nombreCompleto} a la lista de pendientes?`)) return;
    try {
      await quitarCompletado(cursoActivo.id, colab.noNomina);
    } catch (err: any) {
      alert('No se pudo quitar: ' + (err?.message || 'Error desconocido'));
    }
  };

  const totalPaginas = Math.ceil(pendientes.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = pendientes.slice(indexInicio, indexInicio + elementosPorPagina);

  // Exportar a Excel respetando columnas visibles y filtros activos
  const handleExportExcel = () => {
    const data = pendientes.map(c => {
      const rowData: Record<string, any> = {};

      if (columnasVisibles.noNomina !== false) rowData['# NOMINA'] = c.noNomina;
      if (columnasVisibles.nombre !== false) rowData['NOMBRE'] = c.nombreCompleto;
      if (columnasVisibles.puesto !== false) rowData['PUESTO'] = c.puesto || '-';

      cursos.forEach(curso => {
        if (columnasVisibles[`curso_${curso.id}`] !== false) {
          const est = obtenerEstadoCurso(c, curso);
          rowData[curso.titulo] = est || '-';
        }
        if (columnasVisibles[`fecha_${curso.id}`] !== false) {
          const est = obtenerEstadoCurso(c, curso);
          rowData[`FECHA (${curso.titulo})`] = est 
            ? `${curso.fechaInicio} | ${curso.horaInicio || '09:00'}-${curso.horaFin || '10:00'} (${calcularDuracion(curso.horaInicio, curso.horaFin)})`
            : '-';
        }
      });


      return rowData;
    });

    // Con un curso filtrado el reporte lleva las dos tablas (SPEC-029): de
    // nada sirve la lista de pendientes sin saber quién ya lo tomó.
    if (!cursoActivo) {
      exportToExcel(data, 'IMPREDIMEX_Matriz_Cursos');
      return;
    }

    const dataCompletados = listaCompletados.map(c => {
      const reg = completados[c.noNomina];
      return {
        '# NOMINA': c.noNomina,
        'NOMBRE': c.nombreCompleto,
        'PUESTO': c.puesto || '-',
        'CURSO': cursoActivo.titulo,
        'REGISTRADO EL': reg?.fecha || '-',
        'REGISTRO POR': reg?.porNombre || '-',
        'CALIF.': reg?.calificacion === undefined ? '-' : reg.calificacion
      };
    });

    exportToExcelSheets(
      [
        { nombre: 'Pendientes', data },
        { nombre: 'Completados', data: dataCompletados }
      ],
      'IMPREDIMEX_Matriz_Cursos'
    );
  };

  // Exportar a PDF respetando columnas visibles y filtros activos
  const handleExportPDF = () => {
    const headers: string[] = [];
    if (columnasVisibles.noNomina !== false) headers.push('# Nómina');
    if (columnasVisibles.nombre !== false) headers.push('Nombre');
    if (columnasVisibles.puesto !== false) headers.push('Puesto');

    cursos.forEach(curso => {
      if (columnasVisibles[`curso_${curso.id}`] !== false) headers.push(curso.titulo);
      if (columnasVisibles[`fecha_${curso.id}`] !== false) headers.push(`Fecha (${curso.titulo})`);
    });


    const rows = pendientes.map(c => {
      const rowArr: (string | number)[] = [];

      if (columnasVisibles.noNomina !== false) rowArr.push(c.noNomina);
      if (columnasVisibles.nombre !== false) rowArr.push(c.nombreCompleto);
      if (columnasVisibles.puesto !== false) rowArr.push(c.puesto || '-');

      cursos.forEach(curso => {
        const est = obtenerEstadoCurso(c, curso);
        if (columnasVisibles[`curso_${curso.id}`] !== false) {
          rowArr.push(est || '-');
        }
        if (columnasVisibles[`fecha_${curso.id}`] !== false) {
          rowArr.push(est ? `${curso.fechaInicio} ${curso.horaInicio || '09:00'}` : '-');
        }
      });


      return rowArr;
    });

    if (!cursoActivo) {
      exportToPDF('IMPREDIMEX — Asignación de Cursos por Colaborador', headers, rows, 'Matriz_Cursos');
      return;
    }

    // Las dos tablas, una tras otra, en el mismo PDF (SPEC-029).
    const rowsCompletados = listaCompletados.map(c => {
      const reg = completados[c.noNomina];
      return [
        c.noNomina,
        c.nombreCompleto,
        c.puesto || '-',
        reg?.fecha || '-',
        reg?.calificacion === undefined ? '-' : String(reg.calificacion)
      ];
    });

    exportToPDFSections(
      `IMPREDIMEX — ${cursoActivo.titulo}`,
      [
        { subtitulo: 'Pendientes de cursar', headers, rows },
        {
          subtitulo: 'Completados',
          headers: ['# Nómina', 'Nombre', 'Puesto', 'Registrado el', 'Calif.'],
          rows: rowsCompletados
        }
      ],
      'Matriz_Cursos'
    );
  };

  return (
    <div>
      <div className="card-industrial">
        
        {/* Encabezado y Filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>
              Control de Cursos Asignados por Colaborador{aplicados ? ` (${pendientes.length})` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Filtro Curso */}
            <select
              value={filtroCurso}
              onChange={(e) => setFiltroCurso(e.target.value)}
              style={{ width: '130px', height: '30px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)', border: '1px solid var(--brand-navy)' }}
            >
              <option value="">Todos los Cursos</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>

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

            {/* Filtro Texto */}
            <input
              type="text" placeholder="Buscar colaborador…"
              value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)}
              style={{ width: '120px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
            />

            {/* Botón Filtrar: la tabla no aparece hasta pulsarlo */}
            <button
              onClick={aplicarFiltros}
              className="btn-industrial-primary"
              style={{ height: '30px', padding: '4px 10px', fontSize: '10px', width: 'auto' }}
              title="Aplicar los filtros y mostrar los resultados"
            >
              <Filter size={13} /> Filtrar
            </button>

            {aplicados && (
              <button
                onClick={limpiarFiltros}
                style={{ height: '30px', padding: '4px 10px', fontSize: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,32,96,.15)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Limpiar los filtros y ocultar la tabla"
              >
                <X size={13} /> Limpiar
              </button>
            )}

            {/* Selector de Columnas */}
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
                <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#fff', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', width: '230px', maxHeight: '250px', overflowY: 'auto', padding: '8px', marginTop: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)', marginBottom: '6px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                    VISIBILIDAD DE COLUMNAS
                  </div>

                  {[
                    { key: 'noNomina', label: '# Nómina' },
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'puesto', label: 'Puesto' },
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

            {/* Redondos y solo con icono (SPEC-029): con el texto dentro, la
                fila de filtros se partía en dos renglones. Miden lo mismo de
                alto que los demás botones para que la fila quede pareja. */}
            <button onClick={handleExportExcel} disabled={!aplicados}
              title={aplicados ? 'Exportar a Excel' : 'Primero pulsa Filtrar'}
              style={{ ...BOTON_REDONDO, background: 'var(--green)', opacity: aplicados ? 1 : 0.45, cursor: aplicados ? 'pointer' : 'not-allowed' }}>
              <FileSpreadsheet size={14} />
            </button>

            <button onClick={handleExportPDF} disabled={!aplicados}
              title={aplicados ? 'Exportar a PDF' : 'Primero pulsa Filtrar'}
              style={{ ...BOTON_REDONDO, background: 'var(--brand-red)', opacity: aplicados ? 1 : 0.45, cursor: aplicados ? 'pointer' : 'not-allowed' }}>
              <FileText size={14} />
            </button>

            {/* Pasa a Completados a todos los palomeados (SPEC-028). Una sola
                escritura para toda la sesión. */}
            {puedeCapturar && (() => {
              const listo = !!cursoActivo && cuantosMarcados > 0 && !guardandoCursado;
              return (
                <button
                  onClick={actualizarCursados}
                  disabled={!listo}
                  title={
                    !cursoActivo ? 'Primero filtra por un curso'
                    : cuantosMarcados === 0 ? 'Palomea a quienes tomaron el curso'
                    : `Pasar ${cuantosMarcados} a Completados`
                  }
                  style={{ ...BOTON_REDONDO, background: 'var(--brand-navy)', position: 'relative', opacity: listo ? 1 : 0.45, cursor: listo ? 'pointer' : 'not-allowed' }}
                >
                  <RefreshCw size={14} style={guardandoCursado ? { animation: 'spin 1s linear infinite' } : undefined} />
                  {/* Cuántos van marcados. Sin este número, al quitarle el
                      texto al botón no habría forma de saberlo sin contar
                      casillas a mano. */}
                  {cuantosMarcados > 0 && !guardandoCursado && (
                    <span style={{
                      position: 'absolute', top: '-3px', right: '-3px', minWidth: '15px', height: '15px',
                      borderRadius: '999px', background: 'var(--brand-red)', color: '#fff',
                      fontSize: '9px', fontWeight: 700, lineHeight: '15px', textAlign: 'center',
                      padding: '0 3px', border: '1.5px solid #fff'
                    }}>
                      {cuantosMarcados}
                    </span>
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {!aplicados ? (
          <div style={{ textAlign: 'center', padding: '2.2rem 1rem', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
            Elige los filtros que necesites y pulsa <b style={{ color: 'var(--brand-navy)' }}>Filtrar</b>.
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
              Sin ningún filtro, se muestra todo el personal.
            </span>
          </div>
        ) : (
        <>
        {/* Tabla */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {columnasVisibles.noNomina !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>}
                {columnasVisibles.nombre !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>}
                {columnasVisibles.puesto !== false && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>}

                {cursos.map(cur => (
                  <React.Fragment key={cur.id}>
                    {columnasVisibles[`curso_${cur.id}`] !== false && (
                      <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', background: 'rgba(0,32,96,0.03)' }}>
                        {cur.titulo}
                      </th>
                    )}
                    {columnasVisibles[`fecha_${cur.id}`] !== false && (
                      <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: '#5A6A80', textTransform: 'uppercase', background: 'rgba(0,32,96,0.01)', whiteSpace: 'nowrap' }}>
                        Fecha
                      </th>
                    )}
                  </React.Fragment>
                ))}

                {cursoActivo && (
                  <>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Cursado</th>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Calif.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={3 + cursos.length * 2 + (cursoActivo ? 2 : 0)} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
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


                    {columnasVisibles.puesto !== false && (
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                    )}

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

                    {cursoActivo && (
                      <>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <div
                            onClick={() => alternarMarcado(colab.noNomina)}
                            title={puedeCapturar ? 'Marcar como cursado' : 'No tienes permiso de captura'}
                            style={{
                              width: '16px', height: '16px', margin: '0 auto', borderRadius: '3px',
                              border: '1.5px solid ' + (marcados[colab.noNomina] ? 'var(--brand-navy)' : 'var(--border-mid)'),
                              background: marcados[colab.noNomina] ? 'var(--brand-navy)' : '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: puedeCapturar ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {marcados[colab.noNomina] && <Check size={11} color="#fff" strokeWidth={3} />}
                          </div>
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          {/* Opcional: hay cursos sin examen. */}
                          <input
                            type="number" inputMode="numeric"
                            min={CALIFICACION_MIN} max={CALIFICACION_MAX}
                            value={califs[colab.noNomina] || ''}
                            onChange={e => setCalifs(prev => ({ ...prev, [colab.noNomina]: e.target.value }))}
                            disabled={!puedeCapturar || !marcados[colab.noNomina]}
                            placeholder="—"
                            title={marcados[colab.noNomina] ? 'Calificación (opcional)' : 'Primero marca Cursado'}
                            style={{
                              width: '52px', height: '24px', padding: '2px 4px', fontSize: '10px',
                              textAlign: 'center', fontFamily: 'inherit', borderRadius: '5px',
                              border: '1px solid var(--border-mid)',
                              background: marcados[colab.noNomina] ? '#fff' : 'var(--bg-light)'
                            }}
                          />
                        </td>
                      </>
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
              Mostrando {indexInicio + 1} - {Math.min(indexInicio + elementosPorPagina, pendientes.length)} de {pendientes.length}
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
        </>
        )}
      </div>

      {/* ── SECCIÓN: COMPLETADOS (SPEC-028) ───────────────────────────────
          Quienes ya cursaron el curso filtrado. Salen de la tabla de arriba,
          que así queda mostrando únicamente a los que faltan. */}
      {cursoActivo && (
        <div className="card-industrial" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="bar-accent"></div>
              <div className="sec-title" style={{ margin: 0 }}>Completados ({listaCompletados.length})</div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{cursoActivo.titulo}</div>
          </div>

          {listaCompletados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.6rem 1rem', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
              Todavía nadie tiene este curso registrado.
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                Palomea arriba la casilla <b style={{ color: 'var(--brand-navy)' }}>Cursado</b> y pulsa <b style={{ color: 'var(--brand-navy)' }}>Actualizar</b>.
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: '#5A6A80', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Registrado</th>
                    <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', textAlign: 'center' }}>Calif.</th>
                    {puedeCapturar && <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase', textAlign: 'center' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {listaCompletados.map(colab => {
                    const reg = completados[colab.noNomina];
                    return (
                      <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                        <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                        <td style={{ padding: '5px 8px', fontSize: '8.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {reg?.fecha || '-'}
                          {reg?.porNombre && (
                            <div style={{ fontSize: '8px', color: 'var(--text-light)' }}>por {reg.porNombre}</div>
                          )}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          {/* Editable: el examen se suele calificar días después
                              de la sesión. */}
                          <input
                            type="number" inputMode="numeric"
                            min={CALIFICACION_MIN} max={CALIFICACION_MAX}
                            defaultValue={reg?.calificacion ?? ''}
                            key={`${colab.noNomina}-${reg?.calificacion ?? ''}`}
                            onBlur={e => {
                              const v = e.target.value.trim();
                              const actual = reg?.calificacion === undefined ? '' : String(reg.calificacion);
                              if (v !== actual) cambiarCalifCompletado(colab.noNomina, v);
                            }}
                            disabled={!puedeCapturar}
                            placeholder="—"
                            style={{
                              width: '52px', height: '24px', padding: '2px 4px', fontSize: '10px',
                              textAlign: 'center', fontFamily: 'inherit', borderRadius: '5px',
                              border: '1px solid var(--border-mid)',
                              background: puedeCapturar ? '#fff' : 'var(--bg-light)'
                            }}
                          />
                        </td>
                        {puedeCapturar && (
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => regresarAPendientes(colab)}
                              title="Regresar a pendientes"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px 4px' }}
                            >
                              <Undo2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
