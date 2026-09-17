import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight, Eye, Cake, FileSpreadsheet } from 'lucide-react';
import type { Colaborador, Vacante } from '../types/rrhh';
import { subscribeColaboradores, ordenarPorNomina, guardarFechasNacimiento } from '../services/personalService';
import { subscribeVacantes, saveVacante, deleteVacante } from '../services/vacanteService';
import { usePermisos, useSesion } from '../services/SesionContext';
import { partesFecha, diaYMes, edadQueCumple } from '../utils/fechas';
import { CUMPLEANOS_INICIALES } from '../data/cumpleanos';
import { BarrasVerticales, BarrasHorizontales, COLORES } from './Graficas';
import { puedeVerGraficas } from '../services/permisosPadron';
import { DEPARTAMENTOS } from '../utils/catalogos';
import { SelectorPuesto } from './SelectorPuesto';
import { exportToExcel } from '../utils/exportUtils';

export const AntiguedadVacantesModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [filtro, setFiltro] = useState('');
  const { puedeCapturar, papel } = usePermisos();
  const sesion = useSesion();
  const [filtroCumple, setFiltroCumple] = useState('');
  const [verFaltantes, setVerFaltantes] = useState(false);
  // Evita reintentar la siembra en cada llegada del padrón desde Firestore:
  // la suscripción dispara varias veces y sin esto se repetiría el lote.
  const sembrado = React.useRef(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  const [formVacante, setFormVacante] = useState<Vacante>({
    puesto: '',
    departamento: '',
    cantidadRequerida: 1,
    cantidadCubierta: 0,
    estatus: 'ABIERTA',
    fechaCreacion: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const unsubColab = subscribeColaboradores((data) => setColaboradores(ordenarPorNomina(data)));
    const unsubVac = subscribeVacantes((data) => setVacantes(data));
    return () => {
      unsubColab();
      unsubVac();
    };
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  /**
   * Siembra las fechas de nacimiento que vienen en el código (SPEC-017).
   *
   * Solo rellena huecos: nunca pisa una fecha que ya esté en el padrón, para
   * que una corrección hecha en el Directorio no se deshaga sola en la
   * siguiente visita. Cuando todos tienen fecha, esto no vuelve a escribir.
   *
   * Lo hace únicamente quien puede capturar, porque las reglas de Firestore no
   * dejarían escribir a los demás; si falla, se anota en consola y la pantalla
   * sigue funcionando con lo que ya haya.
   */
  useEffect(() => {
    if (sembrado.current || !puedeCapturar || !colaboradores.length) return;

    const pendientes = colaboradores
      .filter(c => !partesFecha(c.fechaNacimiento))
      .map(c => ({ noNomina: String(c.noNomina).trim(), fechaNacimiento: CUMPLEANOS_INICIALES[String(c.noNomina).trim()] }))
      .filter((x): x is { noNomina: string; fechaNacimiento: string } => Boolean(x.fechaNacimiento));

    if (!pendientes.length) { sembrado.current = true; return; }

    sembrado.current = true;
    guardarFechasNacimiento(pendientes, sesion?.nomina || '')
      .catch(err => {
        console.error('No se pudieron sembrar las fechas de nacimiento:', err);
        // Se permite reintentar en la próxima visita: el fallo suele ser de red.
        sembrado.current = false;
      });
  }, [colaboradores, puedeCapturar, sesion]);

  const calcularAntiguedad = (fechaIngresoStr?: string) => {
    // `new Date('2020-03-01')` da la medianoche UTC, que en México cae el 29 de
    // febrero: quien entró un día 1 se corría al mes anterior y desaparecía de
    // la lista de aniversarios. Por eso se parte la cadena a mano.
    const p = partesFecha(fechaIngresoStr);
    if (!p) return { anios: 0, meses: 0, esAniversarioMes: false };
    const hoy = new Date();
    const ingreso = new Date(p.anio, p.mes - 1, p.dia);

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
    if (!puedeCapturar) return;
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

  // Solo quienes cumplen aniversario este mes: la tabla es para actuar sobre
  // ellos, y con el padrón completo la docena que importa se perdía entre
  // cientos de renglones. `esAniversarioMes` ya exige que hayan cumplido al
  // menos un año, así que quien acaba de entrar no aparece.
  const listaFiltrada = ordenarPorNomina(
    colaboradores.filter(c => calcularAntiguedad(c.fechaIngreso).esAniversarioMes).filter(c =>
      c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
      c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase())) ||
      (c.puesto && c.puesto.toLowerCase().includes(filtro.toLowerCase()))
    )
  );

  // Cumpleaños del mes en curso (SPEC-017). Se compara solo el mes, nunca el
  // año: la lista es para felicitar, no para calcular antigüedad.
  const mesHoy = new Date().getMonth() + 1;
  const diaHoy = new Date().getDate();
  const cumpleanosDelMes = colaboradores
    .filter(c => c.estatus !== 'BAJA')
    .map(c => ({ colab: c, p: partesFecha(c.fechaNacimiento) }))
    .filter(x => x.p !== null && x.p!.mes === mesHoy)
    .filter(x =>
      x.colab.nombreCompleto.toLowerCase().includes(filtroCumple.toLowerCase()) ||
      x.colab.noNomina.toLowerCase().includes(filtroCumple.toLowerCase()) ||
      (x.colab.departamento || '').toLowerCase().includes(filtroCumple.toLowerCase())
    )
    // Por día del mes: así la lista se lee como un calendario y se ve de un
    // vistazo lo que viene esta semana.
    .sort((a, b) => a.p!.dia - b.p!.dia);

  // Quiénes, no cuántos: un número suelto no permite actuar. Con los nombres
  // a la vista se sabe exactamente a quién hay que editar en el Directorio.
  const faltantesNacimiento = ordenarPorNomina(
    colaboradores.filter(c => c.estatus !== 'BAJA' && !partesFecha(c.fechaNacimiento))
  );
  const sinFechaNacimiento = faltantesNacimiento.length;

  // Las gráficas concentran información de toda la plantilla, así que se
  // reservan a quien tenga el permiso en el padrón (SPEC-019).
  const verGraficas = puedeVerGraficas(papel, sesion?.nomina, colaboradores);

  // ── Datos de las gráficas ──────────────────────────────────────────────
  const activos = colaboradores.filter(c => c.estatus !== 'BAJA');

  /**
   * Antigüedad: cuánta gente hay en cada tramo de años cumplidos.
   *
   * Se cuenta sobre el padrón activo completo, no sobre la tabla de arriba:
   * esa solo trae a quienes cumplen aniversario este mes, y una gráfica de
   * doce personas no dice nada de la plantilla.
   */
  const tramosAntiguedad = (() => {
    const tramos: { etiqueta: string; min: number; max: number }[] = [
      { etiqueta: '< 1', min: 0, max: 0 },
      { etiqueta: '1-2', min: 1, max: 2 },
      { etiqueta: '3-5', min: 3, max: 5 },
      { etiqueta: '6-10', min: 6, max: 10 },
      { etiqueta: '11-15', min: 11, max: 15 },
      { etiqueta: '16+', min: 16, max: 200 }
    ];
    return tramos.map(t => ({
      etiqueta: t.etiqueta,
      valor: activos.filter(c => {
        if (!partesFecha(c.fechaIngreso)) return false;
        const a = calcularAntiguedad(c.fechaIngreso).anios;
        return a >= t.min && a <= t.max;
      }).length
    }));
  })();

  const sinFechaIngreso = activos.filter(c => !partesFecha(c.fechaIngreso)).length;

  /**
   * Rotación: altas contra bajas, mes a mes, en los últimos doce meses.
   *
   * Las altas salen de `fechaIngreso`, que es la fecha real de contratación y
   * existe desde siempre. Las bajas salen de `fechaBaja`, que se empezó a
   * registrar con esta versión, así que los meses anteriores aparecerán en
   * cero aunque sí haya habido bajas. No se usa `actualizadoEn` como sustituto
   * porque cambia con cualquier edición y pintaría bajas donde no las hubo.
   */
  const rotacionMeses = (() => {
    const hoy = new Date();
    const meses: { clave: string; etiqueta: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({
        clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        etiqueta: d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
      });
    }
    const mesDe = (iso?: string) => {
      const p = partesFecha(iso);
      return p ? `${p.anio}-${String(p.mes).padStart(2, '0')}` : null;
    };
    return meses.map(m => ({
      etiqueta: m.etiqueta,
      valor: colaboradores.filter(c => mesDe(c.fechaIngreso) === m.clave).length,
      valor2: colaboradores.filter(c => c.estatus === 'BAJA' && mesDe(c.fechaBaja) === m.clave).length
    }));
  })();

  const bajasRegistradas = colaboradores.filter(c => c.estatus === 'BAJA' && partesFecha(c.fechaBaja)).length;
  const bajasSinFecha = colaboradores.filter(c => c.estatus === 'BAJA' && !partesFecha(c.fechaBaja)).length;

  /** Vacantes: plazas pedidas contra plazas ya cubiertas, por departamento. */
  const vacantesPorDepto = (() => {
    const mapa = new Map<string, { req: number; cub: number }>();
    vacantes.forEach(v => {
      const d = (v.departamento || 'SIN DEPARTAMENTO').trim().toUpperCase();
      const prev = mapa.get(d) || { req: 0, cub: 0 };
      mapa.set(d, {
        req: prev.req + (Number(v.cantidadRequerida) || 0),
        cub: prev.cub + (Number(v.cantidadCubierta) || 0)
      });
    });
    return [...mapa.entries()].map(([etiqueta, v]) => ({ etiqueta, valor: v.req, valor2: v.cub }));
  })();

  const plazasPendientes = vacantesPorDepto.reduce((t, d) => t + Math.max(0, d.valor - (d.valor2 ?? 0)), 0);

  const totalPaginas = Math.ceil(listaFiltrada.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = listaFiltrada.slice(indexInicio, indexInicio + elementosPorPagina);

  return (
    <div>
      {/* SECCIÓN 1: CONTROL DE ANTIGÜEDAD Y ANIVERSARIOS */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>
              Aniversarios de {new Date().toLocaleDateString('es-MX', { month: 'long' })} ({listaFiltrada.length})
            </div>
          </div>
          <input
            type="text" placeholder="Buscar colaborador…"
            value={filtro} onChange={(e) => setFiltro(e.target.value)}
            style={{ width: '160px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
          />
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Ingreso</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Antigüedad</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Alerta de Aniversario</th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Nadie cumple aniversario este mes.
                  </td>
                </tr>
              ) : (
                colaboradoresPaginados.map((colab) => {
                  const { anios, meses, esAniversarioMes } = calcularAntiguedad(colab.fechaIngreso);
                  return (
                    <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                      <td style={{ padding: '5px 8px' }}>{colab.departamento || '-'}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.fechaIngreso || '-'}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--brand-navy-dark)' }}>
                        {anios} a, {meses} m
                      </td>
                      <td style={{ padding: '5px 8px' }}>
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

      {/* GRÁFICA DE ANTIGÜEDAD (SPEC-018), solo con permiso */}
      {verGraficas && (
      <div className="card-industrial">
        <BarrasVerticales
          titulo="Antigüedad de la plantilla"
          datos={tramosAntiguedad}
          nota={`Años cumplidos de los ${activos.length} colaboradores activos.` +
            (sinFechaIngreso ? ` ${sinFechaIngreso} no aparecen porque no tienen fecha de ingreso capturada.` : '')}
          mensajeVacio="Sin fechas de ingreso capturadas."
        />
      </div>
      )}

      {/* SECCIÓN 2: CUMPLEAÑOS DEL MES (SPEC-017) */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cake size={14} /> Cumpleaños de {new Date().toLocaleDateString('es-MX', { month: 'long' })} ({cumpleanosDelMes.length})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Buscar colaborador…"
              value={filtroCumple} onChange={(e) => setFiltroCumple(e.target.value)}
              style={{ width: '160px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
            />
            <button
              onClick={() => exportToExcel(
                cumpleanosDelMes.map(x => ({
                  '# NOMINA': x.colab.noNomina,
                  'NOMBRE': x.colab.nombreCompleto,
                  'DEPARTAMENTO': x.colab.departamento || '-',
                  'PUESTO': x.colab.puesto || '-',
                  'CUMPLEAÑOS': diaYMes(x.colab.fechaNacimiento),
                  'EDAD QUE CUMPLE': edadQueCumple(x.colab.fechaNacimiento) ?? '-'
                })),
                `Cumpleanos_${new Date().toLocaleDateString('es-MX', { month: 'long' })}`
              )}
              disabled={!cumpleanosDelMes.length}
              className="btn-industrial-success"
              style={{ height: '30px', opacity: cumpleanosDelMes.length ? 1 : 0.45, cursor: cumpleanosDelMes.length ? 'pointer' : 'not-allowed' }}
              title="Exportar los cumpleaños del mes a Excel"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>

        {puedeCapturar && sinFechaNacimiento > 0 && (
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '7px 10px', marginBottom: '0.6rem', lineHeight: 1.45 }}>
            <b>{sinFechaNacimiento}</b> colaborador(es) activos no tienen fecha de nacimiento, así que no pueden aparecer aquí.
            Captúrala en <b>Directorio</b>, editando a cada quien.
            <button
              onClick={() => setVerFaltantes(v => !v)}
              style={{ marginLeft: '6px', background: 'transparent', border: 'none', padding: 0, color: 'var(--brand-navy)', fontWeight: 700, fontSize: '10.5px', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {verFaltantes ? 'Ocultar' : 'Ver quiénes'}
            </button>
            {verFaltantes && (
              <div style={{ marginTop: '6px', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {faltantesNacimiento.map(c => (
                  <div key={c.noNomina} style={{ fontSize: '10px', color: 'var(--text-primary)' }}>
                    <b style={{ color: 'var(--brand-navy)' }}>{c.noNomina}</b> — {c.nombreCompleto}
                    <span style={{ color: 'var(--text-secondary)' }}> ({c.departamento || 'sin departamento'})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Cumpleaños</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Edad</th>
              </tr>
            </thead>
            <tbody>
              {cumpleanosDelMes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '1.4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {sinFechaNacimiento === colaboradores.filter(c => c.estatus !== 'BAJA').length
                      ? 'Todavía no hay fechas de nacimiento cargadas.'
                      : 'Nadie cumple años este mes.'}
                  </td>
                </tr>
              ) : (
                cumpleanosDelMes.map(({ colab, p }) => {
                  const esHoy = p!.dia === diaHoy;
                  const yaPaso = p!.dia < diaHoy;
                  const edad = edadQueCumple(colab.fechaNacimiento);
                  return (
                    <tr key={colab.noNomina} style={{ borderBottom: '1px solid #f1f5f9', background: esHoy ? '#ecfdf5' : 'transparent', opacity: yaPaso ? 0.55 : 1 }}>
                      <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-primary)' }}>{colab.nombreCompleto}</td>
                      <td style={{ padding: '5px 8px' }}><span className="badge-depto">{colab.departamento || '-'}</span></td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {diaYMes(colab.fechaNacimiento)}
                        {esHoy && <b style={{ color: '#059669', marginLeft: '6px' }}>¡Hoy!</b>}
                      </td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{edad !== null ? `${edad} años` : '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRÁFICA DE ROTACIÓN (SPEC-018), solo con permiso */}
      {verGraficas && (
      <div className="card-industrial" style={{ marginTop: '1rem' }}>
        <BarrasVerticales
          titulo="Rotación de los últimos 12 meses"
          datos={rotacionMeses}
          leyenda={[{ texto: 'Altas', color: COLORES.AZUL }, { texto: 'Bajas', color: COLORES.ROJO }]}
          color2={COLORES.ROJO}
          nota={
            bajasRegistradas === 0
              ? 'Las altas salen de la fecha de ingreso. Las bajas se empezaron a fechar con esta versión, así que la barra roja seguirá vacía hasta que se dé de baja a alguien desde el Directorio.'
              : `Altas por fecha de ingreso y bajas por la fecha en que se marcaron.` +
                (bajasSinFecha ? ` ${bajasSinFecha} baja(s) anterior(es) a esta versión no traen fecha y quedan fuera.` : '')
          }
          mensajeVacio="Sin movimientos en los últimos doce meses."
        />
      </div>
      )}

      {/* SECCIÓN 3: CONTROL DE VACANTES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginTop: '1rem' }}>
        
        {!puedeCapturar && (
          <div style={{ background: '#E8EEF8', border: '1px solid rgba(0,53,128,.15)', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px', color: '#003580', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'start' }}>
            <Eye size={15} />
            Estás viendo las vacantes en modo consulta. La apertura de plazas la hace un administrador de Recursos Humanos.
          </div>
        )}

        {puedeCapturar && (
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Abrir Nueva Vacante</div>
          </div>
          <form onSubmit={handleCrearVacante} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Departamento de la lista cerrada, igual que en el Directorio:
                escrito libre aparecían variantes con acento distinto y la misma
                área quedaba partida en dos en las gráficas y los filtros. */}
            <select
              required value={formVacante.departamento}
              onChange={(e) => setFormVacante({ ...formVacante, departamento: e.target.value, puesto: '' })}
            >
              <option value="">Departamento *</option>
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Los puestos se acotan al departamento elegido. Una plaza nueva
                que nunca ha existido se captura con «Otro puesto». */}
            <SelectorPuesto
              colaboradores={colaboradores}
              departamento={formVacante.departamento}
              valor={formVacante.puesto}
              onChange={(v) => setFormVacante(f => ({ ...f, puesto: v }))}
              required
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>REQUERIDAS</label>
                <input
                  type="number" min="1" required value={formVacante.cantidadRequerida}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadRequerida: Number(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>CUBIERTAS</label>
                <input
                  type="number" min="0" required value={formVacante.cantidadCubierta}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadCubierta: Number(e.target.value) })}
                />
              </div>
            </div>
            <button type="submit" className="btn-industrial-primary" style={{ marginTop: '6px' }}>
              <Plus size={16} /> Registrar Vacante
            </button>
          </form>

          {/* GRÁFICA DE VACANTES (SPEC-018), solo con permiso */}
          {verGraficas && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
            <BarrasHorizontales
              titulo="Plazas por departamento"
              datos={vacantesPorDepto}
              leyenda={[{ texto: 'Requeridas', color: COLORES.AZUL }, { texto: 'Cubiertas', color: COLORES.VERDE }]}
              color2={COLORES.VERDE}
              nota={plazasPendientes > 0
                ? `Faltan ${plazasPendientes} plaza(s) por cubrir.`
                : 'Todas las plazas registradas están cubiertas.'}
              mensajeVacio="Todavía no hay vacantes registradas."
            />
          </div>
          )}
        </div>
        )}

        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Estado de Plazas ({vacantes.length})</div>
          </div>
          {vacantes.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '2rem 0' }}>
              No hay vacantes abiertas actualmente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vacantes.map((v) => {
                const badgeBg = v.estatus === 'CUBIERTA' ? 'var(--green-light)' : v.estatus === 'EN_PROCESO' ? 'var(--orange-light)' : 'var(--red-light)';
                const badgeColor = v.estatus === 'CUBIERTA' ? 'var(--green-dark)' : v.estatus === 'EN_PROCESO' ? '#7A4500' : 'var(--brand-red)';

                return (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--brand-navy-dark)', fontSize: '12px' }}>{v.puesto}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{v.departamento} • {v.cantidadCubierta}/{v.cantidadRequerida} plazas</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>
                        {v.estatus}
                      </span>
                      {puedeCapturar && (
                      <button
                        onClick={() => v.id && deleteVacante(v.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                        title="Eliminar vacante"
                      >
                        <Trash2 size={13} />
                      </button>
                      )}
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
