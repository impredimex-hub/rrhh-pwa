import React, { useMemo, useState } from 'react';
import { KeyRound, AlertTriangle, Users } from 'lucide-react';
import type { Colaborador } from '../types/rrhh';
import { APPS_SUITE, leerAcceso } from '../utils/accesosSuite';
import { asignarAccesos, asignarAreasACargo, areasACargoDe } from '../services/personalService';

/** Valor del selector para «sin acceso». */
const SIN_ACCESO = '';
/** Valor del selector para un papel escrito que la app no reconoce. */
const NO_RECONOCIDO = '__no_reconocido__';

interface Props {
  colab: Colaborador;
  /** Los departamentos que existen hoy en el padrón. */
  departamentos: string[];
  /** Nómina de quien está editando: queda en el documento. */
  autor: string;
  onCerrar: () => void;
}

/**
 * Acceso a las apps de la suite (SPEC-037).
 *
 * Reemplaza la edición a mano en la consola de Firebase. Cada app muestra un
 * solo selector: «Sin acceso» o uno de sus papeles, escritos exactamente como
 * la app los espera.
 */
export const AccesosSuiteModal: React.FC<Props> = ({ colab, departamentos, autor, onCerrar }) => {
  const esUnoMismo = String(colab.noNomina).trim() === String(autor).trim();

  /** Lo que tiene hoy, como valor de selector, para saber qué cambió. */
  const inicial = useMemo(() => {
    const v: Record<string, string> = {};
    APPS_SUITE.forEach(app => {
      const e = leerAcceso(app, colab.apps, colab.roles);
      if (!e.tiene) v[app.id] = SIN_ACCESO;
      else if (!e.reconocido) v[app.id] = NO_RECONOCIDO;
      // Con acceso pero sin papel escrito, entra con el de por omisión: se
      // muestra ese, que es el que de verdad tiene.
      else v[app.id] = e.declarado ?? app.porOmision;
    });
    return v;
  }, [colab]);

  const [sel, setSel] = useState<Record<string, string>>(inicial);
  const [guardando, setGuardando] = useState(false);

  /**
   * Áreas que esta persona supervisa (SPEC-046).
   *
   * Es distinto de su departamento: ahí pertenece, y aquí manda. Los
   * supervisores de impresión pertenecen a OPERACIONES y tienen a cargo
   * FLEXOGRAFÍA y ROTOGRABADO. Decide qué roles de turno puede crear y de
   * quién puede reportar faltas.
   */
  const [areas, setAreas] = useState<string[]>(() => areasACargoDe(colab));
  const [guardandoAreas, setGuardandoAreas] = useState(false);

  const alternarArea = async (depto: string) => {
    if (guardandoAreas) return;
    const siguientes = areas.includes(depto)
      ? areas.filter(d => d !== depto)
      : [...areas, depto].sort();
    setAreas(siguientes);
    setGuardandoAreas(true);
    try {
      await asignarAreasACargo(colab.noNomina, siguientes, autor);
    } catch (e: any) {
      // Se revierte en pantalla: dejarlo marcado haría creer que se guardó.
      setAreas(areas);
      setError('No se pudieron guardar las áreas: ' + (e?.message || 'error desconocido'));
    } finally {
      setGuardandoAreas(false);
    }
  };
  const [error, setError] = useState('');

  const cambios = useMemo(() => {
    const c: Record<string, string | null> = {};
    APPS_SUITE.forEach(app => {
      const ahora = sel[app.id];
      if (ahora === inicial[app.id] || ahora === NO_RECONOCIDO) return;
      c[app.id] = ahora === SIN_ACCESO ? null : ahora;
    });
    return c;
  }, [sel, inicial]);

  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await asignarAccesos(colab.noNomina, colab.apps, cambios, autor);
      onCerrar();
    } catch (e: any) {
      // Lo más probable es que las reglas de la suite no permitan escribir
      // estos campos; se dice tal cual para que se sepa dónde buscar.
      setError(
        e?.code === 'permission-denied'
          ? 'Firebase no permitió guardar. Las reglas del proyecto de la suite no dejan cambiar los accesos desde aquí.'
          : 'No se pudo guardar: ' + (e?.message || 'error desconocido')
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={() => !guardando && onCerrar()}
    >
      <div
        style={{ background: '#fff', borderRadius: '14px', padding: '1.4rem', width: '100%', maxWidth: '520px', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,32,96,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '.6rem' }}>
          <KeyRound size={18} /> Acceso a las aplicaciones
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--brand-navy-dark)', lineHeight: 1.6, marginBottom: '1rem' }}>
          <strong>{colab.nombreCompleto}</strong>, nómina <strong>{colab.noNomina}</strong>
          {colab.estatus === 'BAJA' && <span style={{ color: 'var(--brand-red)', fontWeight: 700 }}> · dado de baja</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
          {APPS_SUITE.map(app => {
            const valor = sel[app.id];
            const e = leerAcceso(app, colab.apps, colab.roles);
            // No quitarse a uno mismo el administrador de RRHH: perdería esta
            // misma pantalla y no habría forma de deshacerlo sin la consola.
            const bloqueado = esUnoMismo && app.id === 'rrhh' && inicial.rrhh === 'ADMIN';
            const cambio = app.id in cambios;
            return (
              <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 150px', fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy-dark)' }}>
                  {app.nombre}
                  {cambio && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, color: 'var(--brand-gold, #B8860B)' }}>· cambiará</span>}
                </div>
                <select
                  value={valor}
                  disabled={bloqueado || guardando}
                  onChange={ev => setSel(s => ({ ...s, [app.id]: ev.target.value }))}
                  style={{ flex: '1 1 180px', height: '38px', padding: '4px 10px', fontSize: '13px', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid ' + (cambio ? 'var(--brand-navy)' : 'var(--border-mid)'), background: bloqueado ? 'var(--bg-light)' : '#fff' }}
                >
                  <option value={SIN_ACCESO}>Sin acceso</option>
                  {app.papeles.map(p => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                  {valor === NO_RECONOCIDO && (
                    <option value={NO_RECONOCIDO}>Papel no reconocido: «{e.declarado}»</option>
                  )}
                </select>
                {bloqueado && (
                  <div style={{ flexBasis: '100%', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    No puedes quitarte a ti mismo el administrador de RRHH: perderías esta pantalla.
                  </div>
                )}
                {valor === NO_RECONOCIDO && (
                  <div style={{ flexBasis: '100%', display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '10.5px', color: 'var(--brand-red)' }}>
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                    Tiene escrito «{e.declarado}», que {app.nombre} no reconoce. Elige su papel para corregirlo.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Áreas a cargo. Se guardan al instante, una por una: son un
            permiso, no parte del formulario de accesos. */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '.35rem' }}>
            <Users size={15} /> Áreas a cargo
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '.6rem' }}>
            De qué áreas puede crear roles de turno y reportar faltas. Es distinto de su
            departamento: ahí pertenece, aquí manda.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {departamentos.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>No hay departamentos en el padrón.</span>
            ) : departamentos.map(d => {
              const activo = areas.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => alternarArea(d)}
                  disabled={guardandoAreas || guardando}
                  style={{
                    fontSize: '10px', fontWeight: activo ? 700 : 400, padding: '4px 10px',
                    borderRadius: '20px', fontFamily: 'inherit',
                    border: '1px solid ' + (activo ? 'var(--brand-navy)' : 'var(--border-mid)'),
                    background: activo ? 'var(--brand-navy)' : '#fff',
                    color: activo ? '#fff' : 'var(--text-secondary)',
                    cursor: guardandoAreas ? 'wait' : 'pointer'
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-light)', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
          El cambio se aplica la próxima vez que la persona entre. Si ya tiene una app abierta, debe cerrar
          sesión y volver a entrar para ver su nuevo papel.
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--brand-red)', lineHeight: 1.5, marginBottom: '.8rem' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid var(--brand-navy)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!hayCambios || guardando}
            style={{ flex: 1.4, padding: '11px', borderRadius: '9px', border: 'none', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit', cursor: hayCambios ? 'pointer' : 'not-allowed', opacity: hayCambios ? 1 : .45 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
