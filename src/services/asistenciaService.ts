import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
// La asistencia la escribe EPP, y lo hace en el proyecto compartido de la
// suite: es el único terreno que las dos aplicaciones ya tienen en común. EPP
// guarda sus inspecciones en Realtime Database de su propio proyecto, que
// desde aquí no se ve, y además esos registros traen foto y firma en base64:
// leerlos solo para saber quién vino acabaría con la cuota del plan gratuito.
import { suiteDb as db } from './suite';
import { obtenerManualesRango, subscribeManualesMes, mesesDelRango } from './asistenciaManualService';

const COLLECTION_NAME = 'asistencia';

export interface Asistencia {
  fecha: string;        // 'YYYY-MM-DD'
  noNomina: string;
  nombreCompleto?: string;
  departamento?: string;
  origen?: string;
  ts?: number;
}

/**
 * Asistencias dentro de un rango de fechas, como un conjunto de claves
 * `${noNomina}|${fecha}` listo para consultar celda por celda.
 *
 * Se filtra por rango en la consulta y no en el cliente: un rol mensual mira
 * 31 días, pero la colección crece con cada revisión de cada persona de la
 * planta, todos los días. Traerla completa sería cada vez más caro sin que
 * nadie notara cuándo empezó a serlo.
 */
export const subscribeAsistenciasRango = (
  fechaDesde: string,
  fechaHasta: string,
  callback: (claves: Set<string>) => void
) => {
  if (!fechaDesde || !fechaHasta) {
    callback(new Set());
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('fecha', '>=', fechaDesde),
    where('fecha', '<=', fechaHasta)
  );

  /* Dos fuentes, un solo conjunto (SPEC-032): las revisiones de EPP y las
     asistencias corregidas a mano. Se unen aquí y no en cada pantalla porque
     las faltas se cuentan en tres lugares distintos; separadas, tarde o
     temprano uno de los tres se quedaría sin mirar las correcciones y seguiría
     acusando a quien ya se había dado por presente. */
  let deEPP = new Set<string>();
  let corregidas = new Set<string>();
  const emitir = () => callback(new Set([...deEPP, ...corregidas]));

  const unsubEPP = onSnapshot(q, (snap) => {
    const claves = new Set<string>();
    snap.docs.forEach(d => {
      const a = d.data() as Asistencia;
      if (a.noNomina && a.fecha) claves.add(`${a.noNomina}|${a.fecha}`);
    });
    deEPP = claves;
    emitir();
  }, (err) => {
    // Sin esto, un fallo de permisos dejaría el conjunto vacío y la
    // cuadrícula marcaría ausente a toda la planta sin decir por qué.
    console.error('No se pudieron leer las asistencias', err);
    deEPP = new Set();
    emitir();
  });

  // Las correcciones se guardan por mes; un rango abarca uno o dos.
  const unsubsManual = mesesDelRango(fechaDesde, fechaHasta).map(mes =>
    subscribeManualesMes(mes, (claves) => {
      // Cada mes trae lo suyo; se recorta al rango pedido.
      const soloDelRango = new Set(
        [...claves].filter(k => {
          const f = k.split('|')[1] || '';
          return f >= fechaDesde && f <= fechaHasta;
        })
      );
      // Se conserva lo de los otros meses del rango.
      const otros = [...corregidas].filter(k => (k.split('|')[1] || '').slice(0, 7) !== mes);
      corregidas = new Set([...otros, ...soloDelRango]);
      emitir();
    })
  );

  return () => {
    unsubEPP();
    unsubsManual.forEach(u => u());
  };
};

/**
 * Igual que la suscripción, pero de una sola vez. La usa la exportación, que
 * corre sobre un rol cualquiera de la lista y no sobre el que está abierto,
 * así que no tiene sus asistencias ya cargadas.
 */
/* ── Caché de rangos ya leídos (SPEC-044) ─────────────────────────────────
   Contar las faltas de todos los roles lee las asistencias del tramo que
   cubren, que son miles de documentos. El efecto que lo pide se volvía a
   disparar con cada emisión del padrón o de los roles, y cada disparo era otra
   vez esos miles de lecturas.

   Aquí se recuerda lo leído por rango durante unos minutos. Las asistencias de
   días pasados no cambian, y las de hoy se refrescan al vencer el plazo. */
const _cacheRangos = new Map<string, { claves: Set<string>; expira: number }>();
const VIGENCIA_MS = 3 * 60 * 1000;

/** Se llama cuando alguien corrige una falta a mano: lo leído deja de valer. */
export const olvidarAsistenciasEnCache = () => _cacheRangos.clear();

export const obtenerAsistenciasRango = async (
  fechaDesde: string,
  fechaHasta: string
): Promise<Set<string>> => {
  const claves = new Set<string>();
  if (!fechaDesde || !fechaHasta) return claves;

  const llave = fechaDesde + '|' + fechaHasta;
  const guardado = _cacheRangos.get(llave);
  if (guardado && guardado.expira > Date.now()) return new Set(guardado.claves);
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTION_NAME),
      where('fecha', '>=', fechaDesde),
      where('fecha', '<=', fechaHasta)
    ));
    snap.docs.forEach(d => {
      const a = d.data() as Asistencia;
      if (a.noNomina && a.fecha) claves.add(`${a.noNomina}|${a.fecha}`);
    });
  } catch (err) {
    console.error('No se pudieron leer las asistencias para exportar', err);
    throw err;
  }

  // Las corregidas a mano cuentan igual que una revisión de EPP (SPEC-032).
  // Van fuera del `try` de arriba a propósito: si fallan, el servicio ya tiene
  // su propio registro del error y se prefiere entregar el conteo de EPP antes
  // que no entregar nada.
  const corregidas = await obtenerManualesRango(fechaDesde, fechaHasta);
  corregidas.forEach(k => claves.add(k));

  _cacheRangos.set(llave, { claves: new Set(claves), expira: Date.now() + VIGENCIA_MS });
  return claves;
};
