import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Trash2, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, UserMinus, UserCheck, AlertTriangle, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Colaborador } from '../types/rrhh';
import { saveColaboradoresBatch, subscribeColaboradores, deleteColaborador, cambiarEstatus, ordenarPorNomina } from '../services/personalService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { DEPARTAMENTOS, reconocerDepartamento } from '../utils/catalogos';
import { usePermisos, useSesion } from '../services/SesionContext';

/** Fila del Excel que no se puede guardar, con el motivo. */
interface FilaRechazada {
  fila: number;
  noNomina: string;
  nombreCompleto: string;
  motivo: string;
}

/** Resumen que se muestra antes de escribir nada (SPEC-006). */
interface PreviaImportacion {
  altas: Colaborador[];
  actualizaciones: Colaborador[];
  bajasEncontradas: Colaborador[];
  rechazadas: FilaRechazada[];
}

export const PersonalModule: React.FC = () => {
  const { puedeEditarPadron } = usePermisos();
  const sesion = useSesion();
  // Queda grabado en el documento quién hizo el cambio.
  const autor = sesion?.nomina ?? 'desconocido';

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  const [previa, setPrevia] = useState<PreviaImportacion | null>(null);
  const [reactivarBajas, setReactivarBajas] = useState(false);
  const [porEliminar, setPorEliminar] = useState<Colaborador | null>(null);

  const [formData, setFormData] = useState<Partial<Colaborador>>({
    noNomina: '',
    nombreCompleto: '',
    departamento: '',
    puesto: '',
    fechaIngreso: '',
    estatus: 'ACTIVO'
  });

  useEffect(() => {
    const unsubscribe = subscribeColaboradores((data) => {
      setColaboradores(ordenarPorNomina(data));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEditarPadron) return;
    if (!formData.noNomina || !formData.nombreCompleto) {
      alert('Número de nómina y Nombre completo son obligatorios');
      return;
    }
    if (!formData.departamento) {
      alert('Selecciona un departamento de la lista');
      return;
    }

    setLoading(true);
    try {
      const yaExiste = colaboradores.some(c => String(c.noNomina).trim() === String(formData.noNomina).trim());
      await saveColaboradoresBatch(
        [formData as Colaborador],
        autor,
        yaExiste ? new Set() : new Set([String(formData.noNomina).trim()])
      );
      setFormData({ noNomina: '', nombreCompleto: '', departamento: '', puesto: '', fechaIngreso: '', estatus: 'ACTIVO' });
      alert('Colaborador guardado con éxito');
    } catch (error: any) {
      alert('Error al guardar: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const formatearFechaExcel = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      const date = new Date((val - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
        return `${anio}-${mes}-${dia}`;
      }
    }
    return str;
  };

  /**
   * Lee el archivo y arma el resumen. No escribe nada todavía: la importación
   * pisa nombre, puesto, fecha y departamento de quien ya existe, así que el
   * usuario debe ver qué va a pasar antes de que pase.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !puedeEditarPadron) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        const existentes = new Map(colaboradores.map(c => [String(c.noNomina).trim(), c]));
        const altas: Colaborador[] = [];
        const actualizaciones: Colaborador[] = [];
        const bajasEncontradas: Colaborador[] = [];
        const rechazadas: FilaRechazada[] = [];

        rawData.forEach((row, i) => {
          const fila = i + 2; // +1 por el encabezado, +1 porque Excel cuenta desde 1
          const noNomina = String(row['# NOMINA'] || row['#NOMINA'] || row['NOMINA'] || row['NoNomina'] || row['No. Nomina'] || '').trim();
          const nombreCompleto = String(row['NOMBRE'] || row['Nombre'] || row['NombreCompleto'] || '').trim().toUpperCase();
          const puesto = String(row['PUESTO'] || row['Puesto'] || '').trim().toUpperCase();
          const fechaIngreso = formatearFechaExcel(row['INGRESO'] || row['Ingreso'] || row['FECHA INGRESO'] || row['FechaIngreso'] || '');
          const deptoCrudo = String(row['DEPARTAMENTO'] || row['Departamento'] || row['DEPTO'] || '').trim();

          if (!noNomina || !nombreCompleto) {
            if (noNomina || nombreCompleto) {
              rechazadas.push({ fila, noNomina, nombreCompleto, motivo: 'Falta la nómina o el nombre' });
            }
            return;
          }

          // Un departamento fuera del catálogo deja al trabajador sin equipo
          // asignado en EPP, y falla en silencio. Mejor rechazar la fila.
          const departamento = reconocerDepartamento(deptoCrudo);
          if (!departamento) {
            rechazadas.push({
              fila, noNomina, nombreCompleto,
              motivo: deptoCrudo ? `Departamento no reconocido: "${deptoCrudo}"` : 'Sin departamento'
            });
            return;
          }

          const previo = existentes.get(noNomina);
          const base: Colaborador = { noNomina, nombreCompleto, puesto, fechaIngreso, departamento };

          if (!previo) {
            altas.push({ ...base, estatus: 'ACTIVO' });
          } else {
            actualizaciones.push(base);
            if (previo.estatus === 'BAJA') bajasEncontradas.push(previo);
          }
        });

        if (!altas.length && !actualizaciones.length) {
          alert(
            rechazadas.length
              ? `No se pudo usar ninguna fila. Revisa el archivo: ${rechazadas.length} filas rechazadas.`
              : 'No se encontraron registros válidos. Columnas requeridas: # NOMINA, NOMBRE, PUESTO, INGRESO, DEPARTAMENTO.'
          );
        } else {
          setReactivarBajas(false);
          setPrevia({ altas, actualizaciones, bajasEncontradas, rechazadas });
        }
      } catch (error: any) {
        alert('Error al procesar el archivo Excel: ' + (error?.message || 'Error desconocido'));
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('Error de lectura del archivo.');
      setLoading(false);
      e.target.value = '';
    };

    reader.readAsBinaryString(file);
  };

  const confirmarImportacion = async () => {
    if (!previa) return;
    setLoading(true);
    try {
      const bajas = new Set(previa.bajasEncontradas.map(c => String(c.noNomina).trim()));
      const aGuardar: Colaborador[] = [
        ...previa.altas,
        ...previa.actualizaciones.map(c => {
          // Sin `estatus` el campo no se escribe y el documento conserva el
          // suyo. Así una baja sigue siendo baja salvo que se pida revivirla.
          if (bajas.has(String(c.noNomina).trim())) {
            return reactivarBajas ? { ...c, estatus: 'ACTIVO' as const } : c;
          }
          return c;
        })
      ];
      await saveColaboradoresBatch(
        aGuardar,
        autor,
        new Set(previa.altas.map(c => String(c.noNomina).trim()))
      );
      alert(`Importación terminada: ${previa.altas.length} altas y ${previa.actualizaciones.length} actualizaciones.`);
      setPrevia(null);
    } catch (error: any) {
      alert('Error al guardar: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!porEliminar) return;
    setLoading(true);
    try {
      await deleteColaborador(porEliminar.noNomina);
      setPorEliminar(null);
    } catch (error: any) {
      alert('Error al eliminar: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const alternarEstatus = async (colab: Colaborador) => {
    const nuevo = colab.estatus === 'ACTIVO' ? 'BAJA' : 'ACTIVO';
    const verbo = nuevo === 'BAJA' ? 'dar de baja a' : 'reactivar a';
    if (!confirm(`¿Seguro que quieres ${verbo} ${colab.nombreCompleto} (nómina ${colab.noNomina})?`)) return;
    try {
      await cambiarEstatus(colab.noNomina, nuevo, autor);
    } catch (error: any) {
      alert('Error al cambiar el estatus: ' + (error?.message || 'Error desconocido'));
    }
  };

  const listaFiltrada = ordenarPorNomina(
    colaboradores.filter(c =>
      c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
      c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase())) ||
      (c.puesto && c.puesto.toLowerCase().includes(filtro.toLowerCase()))
    )
  );

  const totalPaginas = Math.ceil(listaFiltrada.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = listaFiltrada.slice(indexInicio, indexInicio + elementosPorPagina);

  const handleExportExcel = () => {
    const data = listaFiltrada.map(c => ({
      '# NOMINA': c.noNomina,
      'NOMBRE': c.nombreCompleto,
      'PUESTO': c.puesto || '-',
      'INGRESO': c.fechaIngreso || '-',
      'DEPARTAMENTO': c.departamento || '-',
      'ESTATUS': c.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Plantilla_Registrada');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Nombre', 'Puesto', 'Ingreso', 'Departamento', 'Estatus'];
    const rows = listaFiltrada.map(c => [
      c.noNomina, c.nombreCompleto, c.puesto || '-', c.fechaIngreso || '-', c.departamento || '-', c.estatus
    ]);
    exportToPDF('IMPREDIMEX — Plantilla Registrada', headers, rows, 'Plantilla_Registrada');
  };

  const capaModal: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  };
  const cajaModal: React.CSSProperties = {
    background: '#fff', borderRadius: '14px', padding: '1.4rem', width: '100%',
    maxWidth: '520px', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,32,96,.25)'
  };

  return (
    <div>
      {!puedeEditarPadron && (
        <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1rem', fontSize: '11.5px', color: '#003580', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={15} />
          Estás viendo el directorio en modo consulta. Las altas, bajas, correcciones e importaciones las hace un administrador de Recursos Humanos.
        </div>
      )}

      {puedeEditarPadron && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>

          {/* Formulario Individual */}
          <div className="card-industrial">
            <div className="card-title-bar">
              <div className="bar-accent"></div>
              <div className="sec-title" style={{ margin: 0 }}>Registro Individual de Colaborador</div>
            </div>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" name="noNomina" placeholder="# Nómina *" required value={formData.noNomina} onChange={handleInputChange} style={{ flex: 1 }} />
                <input type="text" name="nombreCompleto" placeholder="Nombre *" required value={formData.nombreCompleto} onChange={handleInputChange} style={{ flex: 1.5 }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" name="puesto" placeholder="Puesto (ej. OPERADOR)" value={formData.puesto} onChange={handleInputChange} style={{ flex: 1.2 }} />
                <input type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={handleInputChange} style={{ flex: 1 }} />
              </div>
              {/* Se elige de la lista: escribirlo libre es lo que produce las
                  variantes con acento distinto que rompen el filtro de EPP. */}
              <select name="departamento" required value={formData.departamento} onChange={handleInputChange}>
                <option value="">Departamento *</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="submit" disabled={loading} className="btn-industrial-primary" style={{ marginTop: '4px' }}>
                <UserPlus size={16} /> {loading ? 'Guardando…' : 'Guardar Colaborador'}
              </button>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Guardar con una nómina que ya existe actualiza a esa persona. Un alta nueva nace sin acceso a ninguna aplicación.
              </div>
            </form>
          </div>

          {/* Carga Masiva */}
          <div className="card-industrial">
            <div className="card-title-bar">
              <div className="bar-accent"></div>
              <div className="sec-title" style={{ margin: 0 }}>Carga Masiva desde Archivo Excel</div>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
              Columnas requeridas: <code># NOMINA</code>, <code>NOMBRE</code>, <code>PUESTO</code>, <code>INGRESO</code>, <code>DEPARTAMENTO</code>. Verás un resumen antes de que se guarde nada.
            </p>
            <div style={{ border: '2px dashed var(--border-mid)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', background: '#fff' }}>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={loading} id="excel-upload" style={{ display: 'none' }} />
              <label htmlFor="excel-upload" style={{ cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 'bold', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Upload size={22} />
                {loading ? 'Procesando archivo...' : 'Seleccionar plantilla Excel (.xlsx)'}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Plantilla Registrada ({listaFiltrada.length})</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar colaborador…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: '150px', height: '30px', padding: '4px 8px', fontSize: '10px' }} />
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
                {['# Nómina', 'Nombre', 'Puesto', 'Ingreso', 'Departamento', 'Estatus'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>{h}</th>
                ))}
                {puedeEditarPadron && (
                  <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acción</th>
                )}
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={puedeEditarPadron ? 7 : 6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Sin registros que coincidan.
                  </td>
                </tr>
              ) : (
                colaboradoresPaginados.map((colab) => (
                  <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.fechaIngreso || '-'}</td>
                    <td style={{ padding: '5px 8px' }}>
                      {colab.departamento ? (
                        <span style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                          {colab.departamento}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ display: 'inline-block', background: colab.estatus === 'ACTIVO' ? 'var(--green-light)' : 'var(--red-light)', color: colab.estatus === 'ACTIVO' ? 'var(--green-dark)' : 'var(--brand-red)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                        {colab.estatus}
                      </span>
                    </td>
                    {puedeEditarPadron && (
                      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => alternarEstatus(colab)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px 4px' }}
                          title={colab.estatus === 'ACTIVO' ? 'Dar de baja' : 'Reactivar'}
                        >
                          {colab.estatus === 'ACTIVO' ? <UserMinus size={13} /> : <UserCheck size={13} />}
                        </button>
                        <button
                          onClick={() => setPorEliminar(colab)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px 4px' }}
                          title="Eliminar definitivamente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
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
              <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-mid)', background: paginaActual === 1 ? '#f1f5f9' : '#fff', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', fontSize: '10px', color: 'var(--text-primary)' }}>
                <ChevronLeft size={12} /> Anterior
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--brand-navy)' }}>{paginaActual} / {totalPaginas}</span>
              <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-mid)', background: paginaActual === totalPaginas ? '#f1f5f9' : '#fff', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', fontSize: '10px', color: 'var(--text-primary)' }}>
                Siguiente <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vista previa de la importación */}
      {previa && (
        <div style={capaModal} onClick={() => !loading && setPrevia(null)}>
          <div style={cajaModal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#002060', marginBottom: '.4rem' }}>
              Revisa antes de importar
            </div>
            <div style={{ fontSize: '12px', color: '#5A6A80', marginBottom: '1rem', lineHeight: 1.5 }}>
              Todavía no se ha guardado nada. La importación reemplaza nombre, puesto, fecha y departamento de quien ya existe.
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[
                { n: previa.altas.length, t: 'altas nuevas' },
                { n: previa.actualizaciones.length, t: 'actualizaciones' },
                { n: previa.rechazadas.length, t: 'filas rechazadas' }
              ].map(x => (
                <div key={x.t} style={{ flex: 1, minWidth: '110px', background: '#E8EEF8', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#003580' }}>{x.n}</div>
                  <div style={{ fontSize: '10.5px', color: '#5A6A80' }}>{x.t}</div>
                </div>
              ))}
            </div>

            {previa.bajasEncontradas.length > 0 && (
              <div style={{ border: '1px solid rgba(200,16,46,.3)', background: 'rgba(200,16,46,.05)', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#C8102E', marginBottom: '.5rem' }}>
                  <AlertTriangle size={15} /> {previa.bajasEncontradas.length} persona(s) dadas de baja vienen en el archivo
                </div>
                <ul style={{ margin: '0 0 .6rem', paddingLeft: '1.1rem', fontSize: '11.5px', color: '#5A6A80', maxHeight: '120px', overflowY: 'auto' }}>
                  {previa.bajasEncontradas.map(c => (
                    <li key={c.noNomina}>{c.noNomina} — {c.nombreCompleto}</li>
                  ))}
                </ul>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '11.5px', color: '#002060', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reactivarBajas} onChange={e => setReactivarBajas(e.target.checked)} style={{ marginTop: '2px' }} />
                  <span>Reactivarlas y marcarlas como ACTIVO. Si no marcas esto, sus datos se actualizan pero siguen dadas de baja.</span>
                </label>
              </div>
            )}

            {previa.rechazadas.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '.35rem' }}>
                  Filas que no se van a guardar
                </div>
                <div style={{ fontSize: '11px', color: '#5A6A80', maxHeight: '130px', overflowY: 'auto', lineHeight: 1.6 }}>
                  {previa.rechazadas.map((r, i) => (
                    <div key={i}>
                      Fila {r.fila} — {r.noNomina || 's/n'} {r.nombreCompleto}: {r.motivo}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <button onClick={() => setPrevia(null)} disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid rgba(0,32,96,.2)', background: '#fff', color: '#003580', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarImportacion} disabled={loading}
                style={{ flex: 1.4, padding: '11px', borderRadius: '9px', border: 'none', background: '#003580', color: '#fff', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                {loading ? 'Guardando…' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado definitivo */}
      {porEliminar && (
        <div style={capaModal} onClick={() => !loading && setPorEliminar(null)}>
          <div style={{ ...cajaModal, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#C8102E', marginBottom: '.7rem' }}>
              <AlertTriangle size={18} /> Eliminar definitivamente
            </div>
            <div style={{ fontSize: '12.5px', color: '#002060', lineHeight: 1.6, marginBottom: '.8rem' }}>
              Vas a borrar a <strong>{porEliminar.nombreCompleto}</strong>, nómina <strong>{porEliminar.noNomina}</strong>.
            </div>
            <div style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.6, background: 'rgba(200,16,46,.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
              Esta persona <strong>perderá el acceso a todas las aplicaciones de la suite</strong>, incluidas EPP y Procesos, y no queda ningún rastro de la eliminación. No se puede deshacer.
              <br /><br />
              Si simplemente dejó de trabajar aquí, cancela y usa <strong>Dar de baja</strong>: conserva el historial y se puede revertir.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPorEliminar(null)} disabled={loading}
                style={{ flex: 1.4, padding: '11px', borderRadius: '9px', border: 'none', background: '#003580', color: '#fff', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarEliminacion} disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid #C8102E', background: '#fff', color: '#C8102E', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                {loading ? 'Borrando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
