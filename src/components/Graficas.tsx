import React from 'react';

/**
 * Gráficas dibujadas a mano en SVG.
 *
 * No se usa ninguna librería de gráficas a propósito. El proyecto se compila
 * desde el navegador de un teléfono, sin forma de correr `npm` para regenerar
 * `package-lock.json`, y el flujo de publicación instala con ese archivo: meter
 * una dependencia nueva rompería la compilación sin dejar claro por qué. Estas
 * gráficas son pocas y sencillas, así que el SVG a mano sale más barato.
 *
 * Todo se dibuja dentro de un `viewBox` con ancho al 100%, para que escale solo
 * en la pantalla del teléfono sin necesidad de medir el contenedor.
 */

const AZUL = '#003580';
const AZUL_CLARO = '#7FA8DC';
const ROJO = '#C0392B';
const VERDE = '#059669';
const GRIS_TEXTO = '#64748B';

export interface Dato {
  etiqueta: string;
  valor: number;
  /** Segunda barra, cuando la gráfica compara dos cosas. */
  valor2?: number;
  color?: string;
}

/** Envoltura común: título, leyenda y el aviso de cuando no hay nada que mostrar. */
const Marco: React.FC<{
  titulo: string;
  nota?: string;
  leyenda?: { texto: string; color: string }[];
  vacio: boolean;
  mensajeVacio: string;
  children: React.ReactNode;
}> = ({ titulo, nota, leyenda, vacio, mensajeVacio, children }) => (
  <div style={{ marginTop: '0.4rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--brand-navy)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {titulo}
      </div>
      {leyenda && !vacio && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {leyenda.map(l => (
            <span key={l.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: GRIS_TEXTO }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: l.color, display: 'inline-block' }} />
              {l.texto}
            </span>
          ))}
        </div>
      )}
    </div>
    {vacio
      ? <div style={{ padding: '1.1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '10.5px' }}>{mensajeVacio}</div>
      : children}
    {nota && !vacio && (
      <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.45 }}>{nota}</div>
    )}
  </div>
);

/**
 * Barras verticales, para series que se leen en orden: meses, semanas, rangos.
 * Admite una o dos barras por posición.
 */
export const BarrasVerticales: React.FC<{
  titulo: string;
  datos: Dato[];
  leyenda?: { texto: string; color: string }[];
  color?: string;
  color2?: string;
  nota?: string;
  mensajeVacio?: string;
}> = ({ titulo, datos, leyenda, color = AZUL, color2 = AZUL_CLARO, nota, mensajeVacio = 'Sin datos que graficar.' }) => {
  const dobles = datos.some(d => d.valor2 !== undefined);
  const maximo = Math.max(1, ...datos.map(d => Math.max(d.valor, d.valor2 ?? 0)));
  const vacio = !datos.length || datos.every(d => d.valor === 0 && !(d.valor2));

  // Coordenadas internas fijas; el SVG escala solo al ancho disponible.
  // El paso es estrecho a propósito: con doce meses y uno más ancho, la
  // gráfica se salía de la pantalla del teléfono y los últimos meses —los que
  // más importan— quedaban fuera de vista hasta que alguien la arrastrara.
  const ancho = Math.max(300, datos.length * (dobles ? 28 : 26) + 34);
  const altoBarras = 118;
  const base = altoBarras + 16;
  const alto = base + 30;
  // Se reserva un carril a la izquierda para los números del eje; sin él, la
  // primera barra se les encimaba.
  const margenIzq = 22;
  const paso = (ancho - margenIzq - 8) / Math.max(1, datos.length);

  return (
    <Marco titulo={titulo} nota={nota} leyenda={leyenda} vacio={vacio} mensajeVacio={mensajeVacio}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', minWidth: `${Math.min(ancho, 340)}px`, height: 'auto', display: 'block' }} role="img" aria-label={titulo}>
          {/* Rejilla al 25, 50, 75 y 100 por ciento del máximo */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = base - altoBarras * f;
            return (
              <g key={f}>
                <line x1={margenIzq} y1={y} x2={ancho - 8} y2={y} stroke="#E2E8F0" strokeWidth={f === 0 ? 1.2 : 0.7} />
                <text x={margenIzq - 4} y={y + 2.5} fontSize="7" fill={GRIS_TEXTO} textAnchor="end">{Math.round(maximo * f)}</text>
              </g>
            );
          })}

          {datos.map((d, i) => {
            const centro = margenIzq + paso * i + paso / 2;
            const anchoBarra = Math.min(dobles ? 13 : 20, paso * (dobles ? 0.33 : 0.55));
            const h1 = (d.valor / maximo) * altoBarras;
            const h2 = ((d.valor2 ?? 0) / maximo) * altoBarras;
            const x1 = dobles ? centro - anchoBarra - 1.5 : centro - anchoBarra / 2;
            const x2 = centro + 1.5;
            return (
              <g key={d.etiqueta + i}>
                <rect x={x1} y={base - h1} width={anchoBarra} height={h1} fill={d.color || color} rx={2}>
                  <title>{`${d.etiqueta}: ${d.valor}`}</title>
                </rect>
                {d.valor > 0 && (
                  <text x={x1 + anchoBarra / 2} y={base - h1 - 3} fontSize="7.5" fill={GRIS_TEXTO} textAnchor="middle" fontWeight="700">{d.valor}</text>
                )}
                {dobles && (
                  <>
                    <rect x={x2} y={base - h2} width={anchoBarra} height={h2} fill={color2} rx={2}>
                      <title>{`${d.etiqueta}: ${d.valor2 ?? 0}`}</title>
                    </rect>
                    {(d.valor2 ?? 0) > 0 && (
                      <text x={x2 + anchoBarra / 2} y={base - h2 - 3} fontSize="7.5" fill={GRIS_TEXTO} textAnchor="middle" fontWeight="700">{d.valor2}</text>
                    )}
                  </>
                )}
                <text x={centro} y={base + 11} fontSize="7.5" fill={GRIS_TEXTO} textAnchor="middle">{d.etiqueta}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </Marco>
  );
};

/**
 * Barras horizontales, para categorías con nombres largos: departamentos,
 * tipos de incidencia. En vertical esas etiquetas se encimarían o habría que
 * girarlas, que en un teléfono se vuelve ilegible.
 */
export const BarrasHorizontales: React.FC<{
  titulo: string;
  datos: Dato[];
  leyenda?: { texto: string; color: string }[];
  color?: string;
  color2?: string;
  nota?: string;
  mensajeVacio?: string;
  /** Cuántas categorías se muestran como máximo, de mayor a menor. */
  tope?: number;
}> = ({ titulo, datos, leyenda, color = AZUL, color2 = AZUL_CLARO, nota, mensajeVacio = 'Sin datos que graficar.', tope = 12 }) => {
  const dobles = datos.some(d => d.valor2 !== undefined);
  const orden = [...datos].sort((a, b) => Math.max(b.valor, b.valor2 ?? 0) - Math.max(a.valor, a.valor2 ?? 0)).slice(0, tope);
  const maximo = Math.max(1, ...orden.map(d => Math.max(d.valor, d.valor2 ?? 0)));
  const vacio = !orden.length || orden.every(d => d.valor === 0 && !(d.valor2));

  const anchoEtiqueta = 118;
  const ancho = 420;
  const altoFila = dobles ? 26 : 19;
  const alto = Math.max(1, orden.length) * altoFila + 8;
  const pista = ancho - anchoEtiqueta - 34;

  return (
    <Marco titulo={titulo} nota={nota} leyenda={leyenda} vacio={vacio} mensajeVacio={mensajeVacio}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={titulo}>
        {orden.map((d, i) => {
          const y = i * altoFila + 4;
          const altoBarra = dobles ? 8 : 11;
          const w1 = (d.valor / maximo) * pista;
          const w2 = ((d.valor2 ?? 0) / maximo) * pista;
          return (
            <g key={d.etiqueta + i}>
              <text x={0} y={y + (dobles ? 12 : 9)} fontSize="8" fill={GRIS_TEXTO}>
                {d.etiqueta.length > 21 ? d.etiqueta.slice(0, 20) + '…' : d.etiqueta}
                <title>{d.etiqueta}</title>
              </text>
              <rect x={anchoEtiqueta} y={y} width={Math.max(w1, d.valor > 0 ? 2 : 0)} height={altoBarra} fill={d.color || color} rx={2}>
                <title>{`${d.etiqueta}: ${d.valor}`}</title>
              </rect>
              <text x={anchoEtiqueta + Math.max(w1, 2) + 4} y={y + altoBarra - 1.5} fontSize="8" fill={GRIS_TEXTO} fontWeight="700">{d.valor}</text>
              {dobles && (
                <>
                  <rect x={anchoEtiqueta} y={y + altoBarra + 2} width={Math.max(w2, (d.valor2 ?? 0) > 0 ? 2 : 0)} height={altoBarra} fill={color2} rx={2}>
                    <title>{`${d.etiqueta}: ${d.valor2 ?? 0}`}</title>
                  </rect>
                  <text x={anchoEtiqueta + Math.max(w2, 2) + 4} y={y + altoBarra * 2 + 0.5} fontSize="8" fill={GRIS_TEXTO} fontWeight="700">{d.valor2 ?? 0}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </Marco>
  );
};

export const COLORES = { AZUL, AZUL_CLARO, ROJO, VERDE };
