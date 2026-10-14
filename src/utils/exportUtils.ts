import type { jsPDF } from 'jspdf';

/*
 * Las librerías de Excel y PDF pesan más que el resto de la app junta. Se
 * cargan hasta que alguien exporta: así la app abre más rápido y cabe en la
 * caché del teléfono para funcionar sin conexión (SPEC-063).
 */
// El paquete es CommonJS: según el empaquetador, sus funciones llegan sueltas
// o dentro de `default`. Se acepta cualquiera de las dos formas.
const cargarXLSX = async (): Promise<typeof import('xlsx-js-style')> => {
  const m: any = await import('xlsx-js-style');
  return m.utils ? m : m.default;
};
const cargarPDF = async () => {
  const [pdf, tabla] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const p: any = pdf, t: any = tabla;
  return {
    JsPDF: (p.jsPDF || p.default) as typeof import('jspdf').default,
    // Igual que arriba: la función puede venir directa o anidada en `default`.
    autoTable: [t.default, t.default?.default, t.autoTable].find(f => typeof f === 'function') as typeof import('jspdf-autotable').default
  };
};
type LibXLSX = Awaited<ReturnType<typeof cargarXLSX>>;

/**
 * El día de hoy como `AAAA-MM-DD`, para el nombre del archivo.
 *
 * Antes se usaba `toISOString()`, que convierte a UTC: después de las 18:00 en
 * México el archivo salía fechado al día siguiente.
 */
const hoyArchivo = (): string => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

/* ═══════════════════ Diseño común de los Excel (SPEC-063) ═══════════════════
   El mismo que el PDF: título azul, fecha de emisión, encabezado azul con
   letra blanca, renglones alternados y bordes finos. Las celdas van ajustadas
   (texto justificado y en varias líneas) para que nada se corte. */

const AZUL = '2563EB';
const BORDE = { style: 'thin', color: { rgb: 'CBD5E1' } };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

/** «IMPREDIMEX_Matriz_Cursos» → «IMPREDIMEX — Matriz Cursos». */
const tituloDesdeArchivo = (archivo: string) => {
  const limpio = archivo.replace(/^IMPREDIMEX_?/i, '').replace(/_/g, ' ').trim();
  return limpio ? `IMPREDIMEX — ${limpio}` : 'IMPREDIMEX';
};

const fechaEmision = () =>
  `Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`;

/** Una hoja con el diseño del PDF a partir de renglones tipo `{columna: valor}`. */
const hojaConFormato = (XLSX: LibXLSX, data: Record<string, any>[], titulo: string) => {
  const columnas: string[] = [];
  data.forEach(r => Object.keys(r).forEach(k => { if (!columnas.includes(k)) columnas.push(k); }));
  const n = columnas.length;

  const filas: any[][] = [
    [titulo],
    [fechaEmision()],
    [],
    columnas,
    ...data.map(r => columnas.map(c => (r[c] === undefined || r[c] === null ? '' : r[c])))
  ];
  const ws: any = XLSX.utils.aoa_to_sheet(filas);
  const FILA_ENC = 3;   // índice de la fila de encabezados

  // Título y fecha ocupan todo el ancho de la tabla.
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(n - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(n - 1, 0) } }
  ];
  const celda = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })];

  if (celda(0, 0)) celda(0, 0).s = { font: { bold: true, sz: 14, color: { rgb: AZUL } } };
  if (celda(1, 0)) celda(1, 0).s = { font: { sz: 10, color: { rgb: '64748B' } } };

  for (let c = 0; c < n; c++) {
    const h = celda(FILA_ENC, c);
    if (h) h.s = {
      fill: { patternType: 'solid', fgColor: { rgb: AZUL } },
      font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDES
    };
  }
  for (let r = FILA_ENC + 1; r < filas.length; r++) {
    const par = (r - FILA_ENC) % 2 === 0;
    for (let c = 0; c < n; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      const esNumero = typeof ws[ref].v === 'number';
      ws[ref].s = {
        font: { sz: 9, color: { rgb: '1E293B' } },
        alignment: { horizontal: esNumero ? 'right' : 'justify', vertical: 'top', wrapText: true },
        border: BORDES,
        ...(par ? { fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } } } : {})
      };
    }
  }

  // Ancho de cada columna según su contenido, con tope para que el texto
  // largo pase a otro renglón en lugar de hacer columnas kilométricas.
  ws['!cols'] = columnas.map((col, c) => {
    let max = String(col).length;
    for (let r = FILA_ENC + 1; r < filas.length; r++) {
      const v = filas[r][c];
      if (v !== '' && v !== undefined) max = Math.max(max, String(v).length);
    }
    return { wch: Math.min(Math.max(max + 2, 8), 45) };
  });
  ws['!rows'] = [{ hpt: 22 }];
  if (n > 0 && data.length > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: FILA_ENC, c: 0 }, e: { r: filas.length - 1, c: n - 1 } }) };
  }
  return ws;
};

// Exportar a Excel
export const exportToExcel = async (data: Record<string, any>[], fileName: string, titulo?: string) => {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  const XLSX = await cargarXLSX();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, hojaConFormato(XLSX, data, titulo || tituloDesdeArchivo(fileName)), 'Reporte');
  XLSX.writeFile(workbook, `${fileName}_${hoyArchivo()}.xlsx`);
};

/* ═══════════════════ PDF (SPEC-063) ═══════════════════ */

/** Con muchas columnas, hoja horizontal: en vertical el nombre quedaba en tres renglones. */
const nuevoPDF = (JsPDF: typeof import('jspdf').default, columnas: number) => new JsPDF({ orientation: columnas > 6 ? 'landscape' : 'portrait' });

/**
 * Título y fecha. El título se parte en renglones si no cabe: antes se
 * escribía en uno solo y un nombre de curso largo se salía de la hoja.
 * Devuelve dónde empieza lo siguiente.
 */
const encabezadoPDF = (doc: jsPDF, title: string): number => {
  const ancho = doc.internal.pageSize.getWidth() - 28;
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  const lineas = doc.splitTextToSize(title, ancho);
  doc.text(lineas, 14, 15);
  const y = 15 + (lineas.length - 1) * 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(fechaEmision(), 14, y + 7);
  return y + 13;
};

/** Anchos mínimos para que el nombre y la nómina no se partan letra por letra. */
const anchosPDF = (headers: string[]) => {
  const estilos: Record<number, any> = {};
  headers.forEach((h, i) => {
    if (/nombre|colaborador/i.test(h)) estilos[i] = { minCellWidth: 52 };
    else if (/n[oó]mina/i.test(h)) estilos[i] = { minCellWidth: 18 };
    else if (/^(estatus|fecha|turno|calif)/i.test(h)) estilos[i] = { minCellWidth: 24 };
  });
  return estilos;
};

const ESTILO_TABLA = {
  theme: 'grid' as const,
  headStyles: { fillColor: [37, 99, 235] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 10 },
  bodyStyles: { fontSize: 9, textColor: [30, 41, 59] as [number, number, number], valign: 'top' as const },
  alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
  styles: { overflow: 'linebreak' as const, cellPadding: 2 }
};

// Exportar a PDF
export const exportToPDF = async (
  title: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string
) => {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const { JsPDF, autoTable } = await cargarPDF();
  const doc = nuevoPDF(JsPDF, headers.length);
  const y = encabezadoPDF(doc, title);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: y,
    ...ESTILO_TABLA,
    columnStyles: anchosPDF(headers)
  });

  doc.save(`${fileName}_${hoyArchivo()}.pdf`);
};

/**
 * Excel de varias hojas, una por tabla (SPEC-029).
 *
 * Se agregó sin tocar `exportToExcel`, que siguen usando las demás pestañas.
 * Las hojas que vengan vacías se omiten; un libro sin ninguna hoja no se
 * puede escribir, así que en ese caso se avisa y no se descarga nada.
 */
export const exportToExcelSheets = async (
  hojas: { nombre: string; data: Record<string, any>[] }[],
  fileName: string,
  titulo?: string
) => {
  const conDatos = hojas.filter(h => h.data && h.data.length > 0);
  if (conDatos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const XLSX = await cargarXLSX();
  const workbook = XLSX.utils.book_new();
  const base = titulo || tituloDesdeArchivo(fileName);
  conDatos.forEach(h => {
    // Excel no admite nombres de hoja de más de 31 caracteres.
    XLSX.utils.book_append_sheet(workbook, hojaConFormato(XLSX, h.data, `${base} — ${h.nombre}`), h.nombre.slice(0, 31));
  });
  XLSX.writeFile(workbook, `${fileName}_${hoyArchivo()}.xlsx`);
};

/**
 * PDF con varias tablas, una tras otra, cada una con su subtítulo (SPEC-029).
 *
 * Se agregó sin tocar `exportToPDF`, que siguen usando las demás pestañas.
 */
export const exportToPDFSections = async (
  title: string,
  secciones: { subtitulo: string; headers: string[]; rows: (string | number)[][] }[],
  fileName: string
) => {
  const conDatos = secciones.filter(s => s.rows && s.rows.length > 0);
  if (conDatos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const { JsPDF, autoTable } = await cargarPDF();
  const doc = nuevoPDF(JsPDF, Math.max(...conDatos.map(c => c.headers.length)));
  const inicio = encabezadoPDF(doc, title);

  let y = inicio + 2;
  conDatos.forEach((sec, i) => {
    // A partir de la segunda tabla se arranca donde terminó la anterior.
    if (i > 0) y = ((doc as any).lastAutoTable?.finalY || y) + 12;

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${sec.subtitulo} (${sec.rows.length})`, 14, y);

    autoTable(doc, {
      head: [sec.headers],
      body: sec.rows,
      startY: y + 4,
      ...ESTILO_TABLA,
      columnStyles: anchosPDF(sec.headers)
    });
  });

  doc.save(`${fileName}_${hoyArchivo()}.pdf`);
};
