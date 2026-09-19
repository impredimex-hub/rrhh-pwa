import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileSpreadsheet, Eye, TrendingUp } from 'lucide-react';
import type { Colaborador, PromocionInterna, TipoPromocion, EstatusPromocion } from '../types/rrhh';
import { ETIQUETA_PROMOCION, ETIQUETA_ESTATUS_PROMOCION, CALIFICACION_MIN, CALIFICACION_MAX } from '../types/rrhh';
import { subscribeColaboradores } from '../services/personalService';
import { usePermisos, useSesion } from '../services/SesionContext';
import { subscribePromociones, savePromocion, deletePromocion, fechasEvaluaciones, promedioCalificaciones } from '../services/promocionService';
import { todosLosPuestos, CATEGORIAS } from '../utils/catalogos';
import { AutocompletarColaborador } from './AutocompletarColaborador';
import { fechaLocal, hoyISO } from '../utils/fechas';
import { exportToExcel } from '../utils/exportUtils';

/**
 * Promociones internas (SPEC-021).
 *
 * Vivía dentro de Capacitación, de donde salió: son dos cosas distintas —una
 * programa cursos, la otra sigue el avance de una persona hacia otro puesto— y
 * compartir pestaña obligaba a bajar por toda la lista de cursos para llegar.
 */
export const PromocionesModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const { papel } = usePermisos();
  const sesion = useSesion();

  const [promociones, setPromociones] = useState<PromocionInterna[]>([]);
  const [porRechazar, setPorRechazar] = useState<PromocionInterna | null>(null);
  const [resolviendoRechazo, setResolviendoRechazo] = useState(false);
  const [formProm, setFormProm] = useState({
    noNomina: '', tipo: 'PLANTA' as TipoPromocion, destino: '',
    fechaInicio: hoyISO(), observaciones: ''
  });
  const [guardandoProm, setGuardandoProm] = useState(false);

  const puedeCapturarPromociones =
    papel === 'ADMIN' ||
    !!colaboradores.find(c => c.noNomina === sesion?.nomina)?.capturaPromociones;

  useEffect(() => {
    const unsubProm = subscribePromociones(setPromociones);
    const unsubColab = subscribeColaboradores((data) => setColaboradores(data));
    return () => { unsubColab(); unsubProm(); };
  }, []);

  const abrirPromocion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeCapturarPromociones || guardandoProm) return;
    if (!formProm.noNomina || !formProm.fechaInicio) return;
    if (formProm.tipo !== 'PLANTA' && !formProm.destino.trim()) {
      alert('Indica la categoría o el puesto de destino.');
      return;
    }
    // El contrato de planta se obtiene una sola vez, y además se abre solo al
    // dar de alta al colaborador. Sin esta comprobación quedarían dos
    // evaluaciones del mismo concepto para la misma persona.
    if (formProm.tipo === 'PLANTA' && promociones.some(p => p.noNomina === formProm.noNomina && p.tipo === 'PLANTA')) {
      alert('Esa persona ya tiene una evaluación de contrato de planta abierta. Búscala en la lista de abajo.');
      return;
    }

    const c = colaboradores.find(x => x.noNomina === formProm.noNomina);
    const nueva: PromocionInterna = {
      noNomina: formProm.noNomina,
      nombreCompleto: c ? c.nombreCompleto : 'Desconocido',
      departamento: c ? c.departamento : '',
      puestoActual: c ? (c.puesto || '') : '',
      tipo: formProm.tipo,
      fechaInicio: formProm.fechaInicio,
      calificaciones: {},
      estatus: 'EN_PROCESO',
      observaciones: formProm.observaciones.trim(),
      creadoPorNomina: sesion?.nomina || '',
      creadoPorNombre: sesion?.nombre || ''
    };
    // El destino solo se incluye cuando aplica: Firestore rechaza el documento
    // completo si encuentra un campo en `undefined`.
    if (formProm.tipo !== 'PLANTA') nueva.destino = formProm.destino.trim();

    setGuardandoProm(true);
    try {
      await savePromocion(nueva);
      setFormProm({ noNomina: '', tipo: 'PLANTA', destino: '', fechaInicio: hoyISO(), observaciones: '' });
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar la evaluación. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardandoProm(false);
    }
  };

  const calificarMes = async (p: PromocionInterna, mes: number, valor: string) => {
    if (!puedeCapturarPromociones) return;
    const calificaciones = { ...(p.calificaciones || {}) };
    if (valor === '') {
      delete calificaciones[String(mes)];
    } else {
      const n = Number(valor);
      if (isNaN(n) || n < CALIFICACION_MIN || n > CALIFICACION_MAX) return;
      calificaciones[String(mes)] = n;
    }
    try {
      await savePromocion({ ...p, calificaciones });
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar la calificación. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  /**
   * Semáforo de una fecha de evaluación (SPEC-021).
   *
   * Solo alarma mientras la evaluación sigue en proceso y ese mes no tiene
   * calificación: en una ya aprobada o rechazada, pintar fechas en rojo sería
   * ruido sobre algo que ya se cerró.
   */
  const colorFecha = (pr: PromocionInterna, iso: string, mes: number): string | undefined => {
    if (pr.estatus !== 'EN_PROCESO') return undefined;
    if (pr.calificaciones && pr.calificaciones[String(mes)] !== undefined) return undefined;
    const f = fechaLocal(iso);
    if (!f) return undefined;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    // Días completos que faltan. En negativo, la fecha ya pasó sin calificar.
    const dias = Math.round((f.getTime() - hoy.getTime()) / 86400000);
    if (dias < 0) return 'var(--brand-red)';
    if (dias <= 3) return '#B45309';
    return undefined;
  };

  const cambiarEstatusProm = async (p: PromocionInterna, estatus: EstatusPromocion) => {
    if (!puedeCapturarPromociones) return;
    // Un rechazo no es un cambio de estatus más: hay que decidir si cierra el
    // caso o si se le abre otro periodo. Se pregunta antes de escribir nada.
    if (estatus === 'RECHAZADA') { setPorRechazar(p); return; }
    try {
      await savePromocion({ ...p, estatus });
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el estatus. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  /** Rechazo definitivo: se cierra y las calificaciones quedan como están. */
  const rechazarDefinitivo = async () => {
    if (!porRechazar) return;
    setResolviendoRechazo(true);
    try {
      await savePromocion({ ...porRechazar, estatus: 'RECHAZADA' });
      setPorRechazar(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setResolviendoRechazo(false);
    }
  };

  /**
   * Segunda oportunidad: se archiva la ronda que terminó y se abre otro periodo
   * de tres meses a partir de hoy.
   *
   * Arranca hoy y no al día siguiente del último corte porque ese corte suele
   * estar en el pasado: encadenarlo dejaría el mes 1 vencido desde el primer
   * momento, en rojo, sin que nadie hubiera tenido oportunidad de calificarlo.
   */
  const darOtroPeriodo = async () => {
    if (!porRechazar) return;
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    setResolviendoRechazo(true);
    try {
      await savePromocion({
        ...porRechazar,
        rondasPrevias: [
          ...(porRechazar.rondasPrevias || []),
          {
            fechaInicio: porRechazar.fechaInicio,
            calificaciones: { ...(porRechazar.calificaciones || {}) },
            cerradaEl: iso,
            cerradaPor: sesion?.nombre || ''
          }
        ],
        fechaInicio: iso,
        calificaciones: {},
        estatus: 'EN_PROCESO'
      });
      setPorRechazar(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setResolviendoRechazo(false);
    }
  };

  const exportarPromocionesExcel = () => {
    exportToExcel(promociones.map(p => {
      const fs = fechasEvaluaciones(p.fechaInicio);
      return {
        '# Nómina': p.noNomina,
        'Colaborador': p.nombreCompleto,
        'Departamento': p.departamento,
        'Puesto actual': p.puestoActual,
        'Tipo': ETIQUETA_PROMOCION[p.tipo],
        'Destino': p.destino || '—',
        'Inicio': p.fechaInicio,
        [`Mes 1 (${fs[0] || ''})`]: p.calificaciones?.['1'] ?? '',
        [`Mes 2 (${fs[1] || ''})`]: p.calificaciones?.['2'] ?? '',
        [`Mes 3 (${fs[2] || ''})`]: p.calificaciones?.['3'] ?? '',
        'Promedio': promedioCalificaciones(p.calificaciones || {}) ?? '',
        'Estatus': ETIQUETA_ESTATUS_PROMOCION[p.estatus],
        'Observaciones': p.observaciones || ''
      };
    }), 'IMPREDIMEX_Promociones_Internas');
  };

  return (
    <div>
      {/* SECCIÓN: PROMOCIONES INTERNAS */}
      <div className="card-industrial" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Promociones Internas ({promociones.length})</div>
          </div>
          {promociones.length > 0 && (
            <button onClick={exportarPromocionesExcel} className="btn-circular btn-circular-excel" title="Exportar a Excel">
              <FileSpreadsheet size={14} />
            </button>
          )}
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.45 }}>
          Evaluación para contrato de planta, nueva categoría dentro del mismo puesto o cambio de puesto.
          El periodo es de tres meses, con una calificación mensual de {CALIFICACION_MIN} a {CALIFICACION_MAX}.
        </p>

        {!puedeCapturarPromociones && (
          <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '9px 12px', marginBottom: '10px', fontSize: '11px', color: '#003580', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Eye size={14} />
            Puedes consultar las evaluaciones, pero no capturarlas ni calificarlas.
          </div>
        )}

        {puedeCapturarPromociones && (
          <form onSubmit={abrirPromocion} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>COLABORADOR *</label>
              <AutocompletarColaborador
                colaboradores={colaboradores}
                valor={formProm.noNomina}
                onChange={v => setFormProm(f => ({ ...f, noNomina: v }))}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>TIPO *</label>
              <select value={formProm.tipo} onChange={e => setFormProm(f => ({ ...f, tipo: e.target.value as TipoPromocion, destino: '' }))}>
                {(Object.keys(ETIQUETA_PROMOCION) as TipoPromocion[]).map(t => (
                  <option key={t} value={t}>{ETIQUETA_PROMOCION[t]}</option>
                ))}
              </select>
            </div>
            {formProm.tipo !== 'PLANTA' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>
                  {formProm.tipo === 'CATEGORIA' ? 'NUEVA CATEGORÍA *' : 'PUESTO DESTINO *'}
                </label>
                {formProm.tipo === 'CATEGORIA' ? (
                  // Escala fija de la empresa, no algo que se deduzca del padrón.
                  <select required value={formProm.destino} onChange={e => setFormProm(f => ({ ...f, destino: e.target.value }))}>
                    <option value="">-- Selecciona --</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  // Todos los puestos del padrón, sin acotar al departamento:
                  // un cambio de puesto suele ser precisamente a otra área.
                  <select required value={formProm.destino} onChange={e => setFormProm(f => ({ ...f, destino: e.target.value }))}>
                    <option value="">-- Selecciona --</option>
                    {todosLosPuestos(colaboradores).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>INICIO DEL PERIODO *</label>
              <input type="date" required value={formProm.fechaInicio} onChange={e => setFormProm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>OBSERVACIONES</label>
              <input type="text" value={formProm.observaciones} placeholder="Opcional" onChange={e => setFormProm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn-industrial-primary" disabled={guardandoProm}
                style={{ width: '100%', opacity: guardandoProm ? 0.5 : 1, cursor: guardandoProm ? 'not-allowed' : 'pointer' }}>
                <Plus size={15} /> {guardandoProm ? 'Guardando…' : 'Abrir evaluación'}
              </button>
            </div>
          </form>
        )}

        {promociones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
            No hay evaluaciones abiertas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {promociones.map(pr => {
              const fs = fechasEvaluaciones(pr.fechaInicio);
              const prom = promedioCalificaciones(pr.calificaciones || {});
              const colorEstatus =
                pr.estatus === 'APROBADA' ? 'var(--green-dark)' :
                pr.estatus === 'RECHAZADA' ? 'var(--brand-red)' : 'var(--brand-navy)';
              return (
                <div key={pr.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--brand-navy-dark)' }}>
                        {pr.nombreCompleto} <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>#{pr.noNomina}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {ETIQUETA_PROMOCION[pr.tipo]}
                        {pr.destino ? ` → ${pr.destino}` : ''}
                        {pr.puestoActual ? ` · desde ${pr.puestoActual}` : ''}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                        Periodo desde {pr.fechaInicio} · abierta por {pr.creadoPorNombre || '—'}
                        {(pr.rondasPrevias?.length || 0) > 0 && (
                          <span style={{ color: 'var(--brand-red)', fontWeight: 700 }}>
                            {' '}· {(pr.rondasPrevias!.length) + 1}º periodo
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {prom !== null && (
                        <span title="Promedio de las calificaciones capturadas"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: 'var(--brand-navy)' }}>
                          <TrendingUp size={12} /> {prom}
                        </span>
                      )}
                      <select
                        value={pr.estatus}
                        disabled={!puedeCapturarPromociones}
                        onChange={e => cambiarEstatusProm(pr, e.target.value as EstatusPromocion)}
                        style={{ height: '24px', fontSize: '9.5px', fontWeight: 700, padding: '0 4px', borderRadius: '5px', border: '1px solid ' + colorEstatus, color: colorEstatus, background: '#fff', fontFamily: 'inherit' }}
                      >
                        {(Object.keys(ETIQUETA_ESTATUS_PROMOCION) as EstatusPromocion[]).map(es => (
                          <option key={es} value={es}>{ETIQUETA_ESTATUS_PROMOCION[es]}</option>
                        ))}
                      </select>
                      {puedeCapturarPromociones && (
                        <button
                          onClick={() => pr.id && window.confirm(`¿Eliminar la evaluación de ${pr.nombreCompleto}?`) && deletePromocion(pr.id)}
                          title="Eliminar evaluación"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-red)', padding: '2px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {[1, 2, 3].map(mes => {
                      // Rojo si el corte ya pasó sin calificar; ámbar si faltan
                      // tres días o menos. Solo mientras siga en proceso.
                      const alarma = colorFecha(pr, fs[mes - 1] || '', mes);
                      return (
                      <div key={mes} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label style={{ fontSize: '8.5px', fontWeight: 700, color: alarma || 'var(--text-secondary)' }}>
                          MES {mes} · {fs[mes - 1] || '—'}
                        </label>
                        <input
                          type="number"
                          min={CALIFICACION_MIN}
                          max={CALIFICACION_MAX}
                          value={pr.calificaciones?.[String(mes)] ?? ''}
                          disabled={!puedeCapturarPromociones}
                          placeholder="—"
                          onChange={e => calificarMes(pr, mes, e.target.value)}
                          style={{ width: '74px', height: '26px', fontSize: '10.5px', padding: '2px 6px', textAlign: 'center', borderColor: alarma || undefined }}
                        />
                      </div>
                      );
                    })}
                  </div>

                  {pr.observaciones && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '7px', lineHeight: 1.4 }}>
                      {pr.observaciones}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Qué hacer con un rechazo (SPEC-021). Se pregunta antes de escribir
          nada: cerrar el caso y dar otra oportunidad son decisiones distintas
          y una de ellas borra las calificaciones de la ronda en curso. */}
      {porRechazar && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,16,48,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
          onClick={() => !resolviendoRechazo && setPorRechazar(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '18px', maxWidth: '430px', width: '100%', boxShadow: '0 16px 40px rgba(0,32,96,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '.6rem' }}>
              Evaluación rechazada
            </div>
            <div style={{ fontSize: '12px', color: 'var(--brand-navy-dark)', lineHeight: 1.6, marginBottom: '.9rem' }}>
              <strong>{porRechazar.nombreCompleto}</strong> · {ETIQUETA_PROMOCION[porRechazar.tipo]}
              {porRechazar.destino ? ` → ${porRechazar.destino}` : ''}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
              ¿El caso termina en rechazo, o se le dan tres meses más para volver a evaluarlo?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={darOtroPeriodo}
                disabled={resolviendoRechazo}
                className="btn-industrial-primary"
                style={{ width: '100%' }}
              >
                {resolviendoRechazo ? 'Guardando…' : 'Dar tres meses más'}
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '-2px' }}>
                Abre un periodo nuevo a partir de hoy y vuelve a dejarla en proceso. Las
                calificaciones de esta ronda se guardan como periodo anterior, no se pierden.
              </div>

              <button
                onClick={rechazarDefinitivo}
                disabled={resolviendoRechazo}
                style={{ width: '100%', height: '34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand-red)', background: '#fff', color: 'var(--brand-red)', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: resolviendoRechazo ? 'wait' : 'pointer', marginTop: '4px' }}
              >
                {resolviendoRechazo ? 'Guardando…' : 'Terminar en rechazo'}
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '-2px' }}>
                Cierra la evaluación. Las calificaciones quedan como están.
              </div>

              <button
                onClick={() => setPorRechazar(null)}
                disabled={resolviendoRechazo}
                style={{ width: '100%', height: '30px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11.5px', fontFamily: 'inherit', cursor: 'pointer', marginTop: '2px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
