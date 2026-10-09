import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { Colaborador, RolTurnos } from '../types/rrhh';
import { areasACargoDe } from '../services/personalService';
import { obtenerControlesEPP } from '../services/faltasService';
import { obtenerHistorialRoles, resumenDeRol } from '../services/turnoService';
import { exportToExcelSheets } from '../utils/exportUtils';
import {
  cumplimientoEPP, cumplimientoRoles, departamentosConRol, rangosLegibles, lunesDe, isoLocal,
  type ControlDelDia, type RolResumen, type ResultadoEPP, type ResultadoRol
} from '../utils/cumplimiento';

/**
 * Cumplimiento de supervisión (SPEC-060): quién no hizo su reporte diario de
 * EPP y qué departamento no tuvo rol de turnos o lo subió tarde.
 *
 * Sin metas ni porcentajes: solo se observa quién falló, qué y cuándo. El
 * administrador ve a todos; cada persona, solo lo suyo.
 */

interface Props {
  colaboradores: Colaborador[];
  roles: RolTurnos[];
  esAdmin: boolean;
  miNomina?: string;
}

const SUB: React.CSSProperties = { fontSize: '9.5px', fontWeight: 700, color: 'var(--brand-navy)', letterSpacing: '.3px' };
const CHIP: React.CSSProperties = {
  display: 'inline-block', fontSize: '9.5px', fontWeight: 700, borderRadius: '6px',
  padding: '1px 6px', marginRight: '4px', marginTop: '3px', whiteSpace: 'nowrap'
};
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const etiquetaDia = (f: string) => {
  const [a, m, d] = f.split('-').map(Number);
  return `${DIA[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};
const fechaHora = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CumplimientoPanel: React.FC<Props> = ({ colaboradores, roles, esAdmin, miNomina }) => {
  const [desde, setDesde] = useState(() => lunesDe(new Date()));
  const [hasta, setHasta] = useState(() => isoLocal(new Date()));
  const [controles, setControles] = useState<Record<string, ControlDelDia> | null>(null);
  const [historial, setHistorial] = useState<RolResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const activos = useMemo(() => colaboradores.filter(c => c.estatus !== 'BAJA'), [colaboradores]);
  const yo = useMemo(() => activos.find(c => c.noNomina === miNomina), [activos, miNomina]);
  const misAreas = useMemo(() => areasACargoDe(yo), [yo]);

  // Quien no es administrador y no tiene áreas a cargo no tiene nada que ver aquí.
  const visible = esAdmin || misAreas.length > 0;

  useEffect(() => {
    if (!visible || !desde || !hasta || desde > hasta) return;
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([obtenerControlesEPP(desde, hasta), obtenerHistorialRoles(desde).catch(e => {
      // La ficha de historial es nueva: si las reglas del proyecto todavía no
      // la permiten, el panel sigue con los roles vivos.
      console.warn('Historial de roles no disponible:', e);
      return [] as RolResumen[];
    })])
      .then(([c, h]) => { if (vigente) { setControles(c); setHistorial(h); } })
      .catch(e => {
        console.error(e);
        // Sin datos de EPP, todos saldrían como incumplidos: mejor decirlo.
        if (vigente) { setControles(null); setError('No se pudieron leer los reportes de EPP. El panel no se calculó.'); }
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [visible, desde, hasta, recarga]);

  /* ── Control de EPP ── */
  const resultadosEPP: ResultadoEPP[] = useMemo(() => {
    if (!controles) return [];
    const obligados = activos
      .filter(c => (c.apps || []).includes('epp') && areasACargoDe(c).length > 0)
      .filter(c => esAdmin || c.noNomina === miNomina)
      .map(c => ({ nomina: c.noNomina, nombre: c.nombreCompleto, areas: areasACargoDe(c) }));
    return cumplimientoEPP(obligados, controles, desde, hasta)
      .sort((a, b) => b.fallas.length - a.fallas.length || a.nombre.localeCompare(b.nombre));
  }, [controles, activos, esAdmin, miNomina, desde, hasta]);

  /* ── Rol de turnos ── */
  const deptosExistentes = useMemo(
    () => Array.from(new Set(activos.map(c => (c.departamento || '').trim().toUpperCase()).filter(Boolean))),
    [activos]
  );
  const { encontrados, faltantes } = useMemo(() => departamentosConRol(deptosExistentes), [deptosExistentes]);

  const resultadosRol: ResultadoRol[] = useMemo(() => {
    if (!controles) return [];
    const responsables: Record<string, string[]> = {};
    encontrados.forEach(d => {
      responsables[d] = activos.filter(c => areasACargoDe(c).includes(d)).map(c => c.nombreCompleto);
    });
    // Roles vivos y fichas de los ya borrados; el vivo manda si están los dos.
    const porId = new Map<string, RolResumen>();
    historial.forEach(h => porId.set(h.id, h));
    roles.forEach(r => {
      const v = resumenDeRol(r);
      const h = porId.get(v.id);
      porId.set(v.id, { ...v, subidoEn: v.subidoEn ?? h?.subidoEn ?? null });
    });
    const deptos = esAdmin ? encontrados : encontrados.filter(d => misAreas.includes(d));
    return cumplimientoRoles(deptos, Array.from(porId.values()), responsables, desde, hasta);
  }, [controles, encontrados, activos, historial, roles, esAdmin, misAreas, desde, hasta]);

  if (!visible) return null;

  const eppConFallas = resultadosEPP.filter(r => r.fallas.length || r.cubiertas.length);
  const eppAlCorriente = resultadosEPP.filter(r => !r.fallas.length && !r.cubiertas.length);
  const rolConFallas = resultadosRol.filter(r => r.sinRol.length || r.tarde.length || r.porProgramar.length);
  const rolAlCorriente = resultadosRol.filter(r => !r.sinRol.length && !r.tarde.length && !r.porProgramar.length);

  const exportar = () => {
    exportToExcelSheets([
      {
        nombre: 'Control EPP',
        data: resultadosEPP.flatMap(r => [
          ...r.fallas.map(f => ({ 'Fecha': f.fecha, '# Nómina': r.nomina, 'Responsable': r.nombre, 'Áreas a cargo': r.areas.join(', '), 'Situación': 'Sin reporte diario de EPP' })),
          ...r.cubiertas.map(f => ({ 'Fecha': f.fecha, '# Nómina': r.nomina, 'Responsable': r.nombre, 'Áreas a cargo': r.areas.join(', '), 'Situación': `Sin registro propio; el área la revisó ${f.cubiertaPor}` }))
        ])
      },
      {
        nombre: 'Rol de turnos',
        data: resultadosRol.flatMap(r => [
          ...(r.sinRol.length ? [{ 'Departamento': r.departamento, 'Responsables': r.responsables.join(', '), 'Situación': 'Días sin rol', 'Detalle': rangosLegibles(r.sinRol) }] : []),
          ...(r.porProgramar.length ? [{ 'Departamento': r.departamento, 'Responsables': r.responsables.join(', '), 'Situación': 'Días próximos sin rol', 'Detalle': rangosLegibles(r.porProgramar) }] : []),
          ...r.tarde.map(t => ({ 'Departamento': r.departamento, 'Responsables': r.responsables.join(', '), 'Situación': 'Rol subido tarde', 'Detalle': `${t.nombre}: subido ${fechaHora(t.subidoEn)} por ${t.creadoPorNombre}, empezaba ${t.fechaInicio}` }))
        ])
      }
    ], `IMPREDIMEX_Cumplimiento_${desde}_a_${hasta}`);
  };

  return (
    <div className="card-industrial">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="bar-accent"></div>
          <div className="sec-title" style={{ margin: 0 }}>Cumplimiento{esAdmin ? '' : ' — lo tuyo'}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setRecarga(n => n + 1)} title="Actualizar" aria-label="Actualizar" className="btn-circular" disabled={cargando}>
            <RefreshCw size={14} />
          </button>
          {esAdmin && (
            <button onClick={exportar} title="Exportar a Excel" aria-label="Exportar a Excel" className="btn-circular btn-circular-excel" disabled={cargando || !controles}>
              <FileSpreadsheet size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={SUB}>DESDE</label>
          <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={SUB}>HASTA</label>
          <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} />
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', borderRadius: '10px', padding: '9px 12px', fontSize: '11.5px', color: 'var(--brand-red)', marginBottom: '8px' }}>{error}</div>
      )}
      {cargando && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '8px 0' }}>Calculando…</div>}

      {!cargando && controles && (
        <>
          {/* ── EPP ── */}
          <div style={{ ...SUB, marginTop: '4px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardCheck size={13} /> REPORTE DIARIO DE EPP · LUNES A SÁBADO
          </div>
          {resultadosEPP.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              {esAdmin ? 'Nadie con áreas a cargo tiene acceso a EPP.' : 'No tienes áreas a cargo en EPP.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {eppConFallas.map(r => (
                <div key={r.nomina} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--brand-navy-dark)' }}>{r.nombre}</div>
                    {r.fallas.length > 0 && (
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-red)', whiteSpace: 'nowrap' }}>
                        {r.fallas.length} día{r.fallas.length === 1 ? '' : 's'} sin reporte
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '1px' }}>{r.areas.join(' · ')}</div>
                  <div>
                    {r.fallas.map(f => (
                      <span key={f.fecha} style={{ ...CHIP, background: 'var(--red-light)', color: 'var(--brand-red)' }}>{etiquetaDia(f.fecha)}</span>
                    ))}
                    {r.cubiertas.map(f => (
                      <span key={f.fecha} title={`No hay registro propio ese día, pero su área la revisó ${f.cubiertaPor}`}
                        style={{ ...CHIP, background: 'var(--bg-light)', color: 'var(--text-secondary)' }}>
                        {etiquetaDia(f.fecha)} · revisó {String(f.cubiertaPor).split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {eppAlCorriente.length > 0 && (
                <div style={{ fontSize: '10.5px', color: 'var(--green-dark)', lineHeight: 1.45 }}>
                  ✓ Al corriente: {eppAlCorriente.map(r => r.nombre).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* ── Rol de turnos ── */}
          <div style={{ ...SUB, marginTop: '6px', marginBottom: '6px' }}>ROL DE TURNOS</div>
          {resultadosRol.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {esAdmin ? 'Ningún departamento obligado a llevar rol se encontró en el padrón.' : 'No tienes a cargo un departamento que lleve rol.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rolConFallas.map(r => (
                <div key={r.departamento} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--brand-navy-dark)' }}>{r.departamento}</div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '1px' }}>
                    {r.responsables.length ? 'A cargo: ' + r.responsables.join(', ') : 'Sin responsable asignado en el Directorio'}
                  </div>
                  {r.sinRol.length > 0 && (
                    <div style={{ fontSize: '10.5px', color: 'var(--brand-red)', fontWeight: 700, marginTop: '4px' }}>
                      Sin rol: {rangosLegibles(r.sinRol)}
                    </div>
                  )}
                  {r.porProgramar.length > 0 && (
                    <div style={{ fontSize: '10.5px', color: '#B45309', marginTop: '3px' }}>
                      Por programar: {rangosLegibles(r.porProgramar)}
                    </div>
                  )}
                  {r.tarde.map(t => (
                    <div key={t.nombre + t.fechaInicio} style={{ fontSize: '10.5px', color: '#B45309', marginTop: '3px' }}>
                      Subido tarde: {t.nombre} — {fechaHora(t.subidoEn)}, empezaba {t.fechaInicio.slice(8, 10)}/{t.fechaInicio.slice(5, 7)}
                    </div>
                  ))}
                </div>
              ))}
              {rolAlCorriente.length > 0 && (
                <div style={{ fontSize: '10.5px', color: 'var(--green-dark)', lineHeight: 1.45 }}>
                  ✓ Al corriente: {rolAlCorriente.map(r => r.departamento).join(', ')}
                </div>
              )}
            </div>
          )}

          {esAdmin && faltantes.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              No se encontró en el padrón: {faltantes.join(', ')}. Si el departamento se llama distinto, hay que agregar su nombre en la lista de la SPEC-060.
            </div>
          )}
          <div style={{ fontSize: '9.5px', color: 'var(--text-light)', marginTop: '8px', lineHeight: 1.4 }}>
            Lo del día en curso no se juzga hasta que cierra: entre semana a las 06:00 del día siguiente, el sábado a las 21:30.
            La puntualidad de un rol solo se conoce para los creados desde esta versión.
          </div>
        </>
      )}
    </div>
  );
};

export default CumplimientoPanel;
