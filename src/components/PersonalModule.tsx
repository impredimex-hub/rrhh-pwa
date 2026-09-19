import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, UserMinus, UserCheck, AlertTriangle, Eye, Pencil, X, CalendarDays } from 'lucide-react';
import type { Colaborador } from '../types/rrhh';
import { saveColaboradoresBatch, subscribeColaboradores, deleteColaborador, cambiarEstatus, cambiarNomina, ordenarPorNomina, fecharBaja } from '../services/personalService';
import { abrirContratoPlanta } from '../services/promocionService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { DEPARTAMENTOS } from '../utils/catalogos';
import { SelectorPuesto } from './SelectorPuesto';
import { diaYMes, hoyISO, partesFecha } from '../utils/fechas';
import { usePermisos, useSesion } from '../services/SesionContext';

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

  const [porEliminar, setPorEliminar] = useState<Colaborador | null>(null);
  // Nómina que se está editando. Null significa alta nueva.
  const [editando, setEditando] = useState<string | null>(null);
  const [porRenombrar, setPorRenombrar] = useState<{de:string; a:string} | null>(null);
  /**
   * Diálogo de la fecha de baja (SPEC-023). `modo` distingue los dos usos:
   * `baja` marca la baja y la fecha de un solo golpe; `fechar` solo corrige la
   * fecha de alguien que ya está dado de baja, sin tocar su estatus.
   */
  const [dialogoBaja, setDialogoBaja] = useState<{ colab: Colaborador; fecha: string; modo: 'baja' | 'fechar' } | null>(null);

  const [formData, setFormData] = useState<Partial<Colaborador>>({
    noNomina: '',
    nombreCompleto: '',
    departamento: '',
    puesto: '',
    fechaIngreso: '',
    fechaNacimiento: '',
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

  const editar = (colab: Colaborador) => {
    setEditando(String(colab.noNomina).trim());
    setFormData({
      noNomina: colab.noNomina, nombreCompleto: colab.nombreCompleto,
      departamento: colab.departamento, puesto: colab.puesto,
      fechaIngreso: colab.fechaIngreso, fechaNacimiento: colab.fechaNacimiento || '', estatus: colab.estatus
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setFormData({ noNomina:'', nombreCompleto:'', departamento:'', puesto:'', fechaIngreso:'', fechaNacimiento:'', estatus:'ACTIVO' });
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

    // Cambiar la nómina no es una edición más: es mover el documento y deja
    // la cuenta de acceso apuntando al número viejo. Se confirma aparte.
    const nuevaNomina = String(formData.noNomina).trim();
    if (editando && editando !== nuevaNomina) {
      setPorRenombrar({ de: editando, a: nuevaNomina });
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

      // Un alta nueva estrena su evaluación de contrato de planta, con el
      // periodo arrancando en su fecha de ingreso (SPEC-016). Va aparte del
      // guardado del padrón y después de él: el colaborador ya quedó
      // registrado, y un fallo aquí no debe deshacer eso ni perderse en
      // silencio.
      let avisoPlanta = '';
      if (!yaExiste) {
        try {
          const abierta = await abrirContratoPlanta(formData as Colaborador, sesion?.nomina || '', sesion?.nombre || '');
          avisoPlanta = abierta
            ? '\n\nSe abrió su evaluación de contrato de planta.'
            : '\n\nNo se abrió la evaluación de contrato de planta porque falta la fecha de ingreso. Captúrala y ábrela desde Capacitación.';
        } catch (err) {
          console.error(err);
          avisoPlanta = '\n\nEl colaborador quedó registrado, pero no se pudo abrir su evaluación de contrato de planta. Ábrela a mano desde Capacitación.';
        }
      }

      setFormData({ noNomina: '', nombreCompleto: '', departamento: '', puesto: '', fechaIngreso: '', fechaNacimiento: '', estatus: 'ACTIVO' });
      setEditando(null);
      alert('Colaborador guardado con éxito' + avisoPlanta);
    } catch (error: any) {
      alert('Error al guardar: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const confirmarRenombrado = async () => {
    if (!porRenombrar) return;
    setLoading(true);
    try {
      await cambiarNomina(porRenombrar.de, formData as Colaborador, autor);
      setPorRenombrar(null);
      cancelarEdicion();
      alert('Nómina cambiada de ' + porRenombrar.de + ' a ' + porRenombrar.a +
            '.\n\nFalta rehacer su cuenta de acceso en la consola de Firebase; ' +
            'mientras tanto esa persona no puede entrar a ninguna aplicación.');
    } catch (error: any) {
      alert('No se pudo cambiar: ' + (error?.message || 'Error desconocido'));
    } finally { setLoading(false); }
  };

  const confirmarEliminacion = async () => {
    if (!puedeEditarPadron) return;
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
    // La baja pasa por el diálogo, porque hay que preguntar el día. La
    // reactivación no: ahí la fecha se borra y no hay nada que capturar.
    if (colab.estatus === 'ACTIVO') {
      setDialogoBaja({ colab, fecha: hoyISO(), modo: 'baja' });
      return;
    }
    if (!confirm(`¿Seguro que quieres reactivar a ${colab.nombreCompleto} (nómina ${colab.noNomina})?`)) return;
    try {
      await cambiarEstatus(colab.noNomina, 'ACTIVO', autor);
    } catch (error: any) {
      alert('Error al cambiar el estatus: ' + (error?.message || 'Error desconocido'));
    }
  };

  /**
   * Qué tiene de malo una fecha de baja, o `null` si está bien.
   *
   * Las tres comprobaciones se hacen comparando texto, nunca con `Date`: el
   * formato `AAAA-MM-DD` ya ordena correctamente y así no se repite el error de
   * zona horaria que documenta `utils/fechas`.
   */
  const problemaConLaFecha = (colab: Colaborador, fecha: string): string | null => {
    if (!partesFecha(fecha)) return 'Falta la fecha, o no es una fecha válida.';
    // Una baja futura descuadraría la rotación del mes en curso: contaría a
    // alguien que todavía está trabajando.
    if (fecha > hoyISO()) return 'La baja no puede ser posterior a hoy.';
    if (colab.fechaIngreso && partesFecha(colab.fechaIngreso) && fecha < colab.fechaIngreso) {
      return `La baja no puede ser anterior a su ingreso (${colab.fechaIngreso}).`;
    }
    return null;
  };

  const confirmarDialogoBaja = async () => {
    if (!dialogoBaja) return;
    const { colab, fecha, modo } = dialogoBaja;
    const problema = problemaConLaFecha(colab, fecha);
    if (problema) { alert(problema); return; }

    setLoading(true);
    try {
      if (modo === 'baja') {
        await cambiarEstatus(colab.noNomina, 'BAJA', autor, fecha);
      } else {
        await fecharBaja(colab.noNomina, fecha, autor);
      }
      setDialogoBaja(null);
    } catch (error: any) {
      alert('No se pudo guardar la fecha: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
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
      'CUMPLEAÑOS': c.fechaNacimiento || '-',
      'DEPARTAMENTO': c.departamento || '-',
      'ESTATUS': c.estatus,
      // Va al Excel para poder cotejar contra nómina cuáles bajas siguen sin
      // fecha. Es solo de lectura: la importación no escribe este campo.
      'FECHA DE BAJA': c.estatus === 'BAJA' ? (c.fechaBaja || 'SIN FECHA') : '-'
    }));
    exportToExcel(data, 'IMPREDIMEX_Plantilla_Registrada');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Nombre', 'Puesto', 'Ingreso', 'Cumpleaños', 'Departamento', 'Estatus'];
    const rows = listaFiltrada.map(c => [
      c.noNomina, c.nombreCompleto, c.puesto || '-', c.fechaIngreso || '-', diaYMes(c.fechaNacimiento), c.departamento || '-', c.estatus
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
        <div style={{ marginBottom: '1rem' }}>

          {/* Formulario Individual */}
          <div className="card-industrial">
            <div className="card-title-bar">
              <div className="bar-accent"></div>
              <div className="sec-title" style={{ margin: 0 }}>
                {editando ? 'Editando la nómina ' + editando : 'Registro Individual de Colaborador'}
              </div>
              {editando && (
                <button type="button" onClick={cancelarEdicion}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'transparent', border: '1px solid var(--border-mid)', borderRadius: '6px',
                    padding: '3px 9px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
                    color: 'var(--text-secondary)' }}>
                  <X size={12} /> Cancelar
                </button>
              )}
            </div>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" name="noNomina" placeholder="# Nómina *" required value={formData.noNomina} onChange={handleInputChange} style={{ flex: 1 }} />
                <input type="text" name="nombreCompleto" placeholder="Nombre *" required value={formData.nombreCompleto} onChange={handleInputChange} style={{ flex: 1.5 }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                {/* El departamento va primero porque de él dependen los
                    puestos que se pueden elegir abajo. Se toma de la lista:
                    escribirlo libre es lo que produce las variantes con acento
                    distinto que rompen el filtro de EPP. */}
                <select
                  name="departamento" required value={formData.departamento} style={{ flex: 1.2 }}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    departamento: e.target.value,
                    // Un puesto de otra área deja de tener sentido. Se limpia
                    // aquí, en el cambio hecho a mano, y no dentro del selector:
                    // allá no se distingue de cargar la ficha para editarla, y
                    // abrir a alguien le vaciaba el puesto.
                    puesto: ''
                  }))}
                >
                  <option value="">Departamento *</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {/* Dos campos de fecha juntos son indistinguibles sin rótulo, y
                    confundirlos mete a alguien de 40 años al control de
                    antigüedad como si acabara de entrar. */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label htmlFor="f-ingreso" style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ingreso</label>
                  <input id="f-ingreso" type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={handleInputChange} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label htmlFor="f-nacimiento" style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Nacimiento</label>
                  <input id="f-nacimiento" type="date" name="fechaNacimiento" value={formData.fechaNacimiento || ''} onChange={handleInputChange} style={{ width: '100%' }} />
                </div>
              </div>
              {/* Los puestos se acotan al departamento elegido arriba. */}
              <SelectorPuesto
                colaboradores={colaboradores}
                departamento={formData.departamento}
                valor={formData.puesto}
                onChange={(v) => setFormData(prev => ({ ...prev, puesto: v }))}
              />
              <button type="submit" disabled={loading} className="btn-industrial-primary" style={{ marginTop: '4px' }}>
                <UserPlus size={16} /> {loading ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Guardar Colaborador')}
              </button>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {editando
                  ? 'Puedes corregir cualquier dato, incluida la nómina. Cambiarla mueve el registro y requiere rehacer su cuenta de acceso.'
                  : 'Guardar con una nómina que ya existe actualiza a esa persona. Un alta nueva nace sin acceso a ninguna aplicación.'}
              </div>
            </form>
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
            <button onClick={handleExportExcel} className="btn-circular btn-circular-excel" title="Exportar a Excel">
              <FileSpreadsheet size={14} />
            </button>
            <button onClick={handleExportPDF} className="btn-circular btn-circular-pdf" title="Exportar a PDF">
              <FileText size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['# Nómina', 'Nombre', 'Puesto', 'Ingreso', 'Cumpleaños', 'Departamento', 'Estatus'].map(h => (
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
                  <td colSpan={puedeEditarPadron ? 8 : 7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
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
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{diaYMes(colab.fechaNacimiento)}</td>
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
                      {/* La fecha de la baja se muestra aquí para que se vea de
                          un vistazo a quién le falta, que es lo que deja huecos
                          en la gráfica de rotación (SPEC-023). */}
                      {colab.estatus === 'BAJA' && (
                        <div style={{ fontSize: '8.5px', marginTop: '2px', whiteSpace: 'nowrap', color: colab.fechaBaja ? 'var(--text-secondary)' : 'var(--brand-red)', fontWeight: colab.fechaBaja ? 400 : 700 }}>
                          {colab.fechaBaja || 'sin fecha'}
                        </div>
                      )}
                    </td>
                    {puedeEditarPadron && (
                      <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => editar(colab)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px 4px' }}
                          title="Editar datos"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => alternarEstatus(colab)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px 4px' }}
                          title={colab.estatus === 'ACTIVO' ? 'Dar de baja' : 'Reactivar'}
                        >
                          {colab.estatus === 'ACTIVO' ? <UserMinus size={13} /> : <UserCheck size={13} />}
                        </button>
                        {/* Solo para quien ya está de baja: corregir el día sin
                            tener que reactivar y volver a dar de baja, que
                            falsearía la fecha (SPEC-023). */}
                        {colab.estatus === 'BAJA' && (
                          <button
                            onClick={() => setDialogoBaja({ colab, fecha: colab.fechaBaja || '', modo: 'fechar' })}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colab.fechaBaja ? 'var(--brand-navy)' : 'var(--brand-red)', padding: '2px 4px' }}
                            title={colab.fechaBaja ? 'Corregir la fecha de baja' : 'Falta la fecha de baja'}
                          >
                            <CalendarDays size={13} />
                          </button>
                        )}
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

      {/* Cambio de nómina: no es una edición más */}
      {porRenombrar && (
        <div style={capaModal} onClick={() => !loading && setPorRenombrar(null)}>
          <div style={{ ...cajaModal, maxWidth: '470px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '.7rem' }}>
              <AlertTriangle size={18} /> Cambiar el número de nómina
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--brand-navy-dark)', lineHeight: 1.6, marginBottom: '.8rem' }}>
              De <strong>{porRenombrar.de}</strong> a <strong>{porRenombrar.a}</strong>, para <strong>{formData.nombreCompleto}</strong>.
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-light)', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
              La nómina es el identificador del registro, así que se mueve a uno nuevo conservando
              sus permisos de todas las aplicaciones.
              <br /><br />
              <strong>Su cuenta de acceso NO se mueve.</strong> Sigue siendo
              {' '}{porRenombrar.de}@impredimex.local, así que hasta que se rehaga en la consola de
              Firebase esta persona no podrá entrar a ninguna aplicación.
              <br /><br />
              Los registros históricos de EPP, Mantenimiento y Calidad conservan la nómina anterior,
              porque guardan copia y no referencia.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPorRenombrar(null)} disabled={loading}
                style={{ flex: 1.4, padding: '11px', borderRadius: '9px', border: 'none', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarRenombrado} disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid var(--brand-navy)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                {loading ? 'Cambiando…' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fecha de la baja (SPEC-023) */}
      {dialogoBaja && (
        <div style={capaModal} onClick={() => !loading && setDialogoBaja(null)}>
          <div style={{ ...cajaModal, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '.7rem' }}>
              <CalendarDays size={18} />
              {dialogoBaja.modo === 'baja' ? 'Dar de baja' : 'Fecha de la baja'}
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--brand-navy-dark)', lineHeight: 1.6, marginBottom: '.9rem' }}>
              <strong>{dialogoBaja.colab.nombreCompleto}</strong>, nómina <strong>{dialogoBaja.colab.noNomina}</strong>.
              {dialogoBaja.colab.fechaIngreso && <> Ingresó el {dialogoBaja.colab.fechaIngreso}.</>}
            </div>

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '4px' }}>
              Último día que trabajó
            </label>
            <input
              type="date"
              value={dialogoBaja.fecha}
              max={hoyISO()}
              min={dialogoBaja.colab.fechaIngreso || undefined}
              onChange={e => setDialogoBaja({ ...dialogoBaja, fecha: e.target.value })}
              style={{ width: '100%', height: '38px', padding: '4px 10px', fontSize: '13px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--border-mid)', marginBottom: '.9rem' }}
            />

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-light)', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
              {dialogoBaja.modo === 'baja' ? (
                <>
                  La persona conserva su historial y se puede reactivar. Esta fecha es la que cuenta
                  para la <strong>gráfica de rotación</strong>, así que si la baja ocurrió antes de hoy,
                  corrígela aquí: después ya no se puede cambiar sin volver a pasar por esta ventana.
                </>
              ) : (
                <>
                  Solo cambia la fecha; el estatus se queda en BAJA.
                  <br /><br />
                  Sirve para las bajas anteriores a la versión 2.11.0, que no traen día y por eso no
                  aparecen en la gráfica de rotación. <strong>El dato no está en el sistema</strong>:
                  tiene que salir del archivo de nómina.
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDialogoBaja(null)} disabled={loading}
                style={{ flex: 1.4, padding: '11px', borderRadius: '9px', border: 'none', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarDialogoBaja} disabled={loading || !dialogoBaja.fecha}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid var(--brand-navy)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: dialogoBaja.fecha ? 'pointer' : 'not-allowed', opacity: dialogoBaja.fecha ? 1 : .5 }}>
                {loading ? 'Guardando…' : 'Guardar'}
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
