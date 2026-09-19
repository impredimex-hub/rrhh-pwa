import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Exportar a Excel
export const exportToExcel = (data: Record<string, any>[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
  XLSX.writeFile(workbook, `${fileName}_${hoyArchivo()}.xlsx`);
};

// Exportar a PDF
export const exportToPDF = (
  title: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string
) => {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const doc = new jsPDF();

  // Encabezado del reporte
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 14, 22);

  // Tabla con autoTable
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
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
export const exportToExcelSheets = (
  hojas: { nombre: string; data: Record<string, any>[] }[],
  fileName: string
) => {
  const conDatos = hojas.filter(h => h.data && h.data.length > 0);
  if (conDatos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  conDatos.forEach(h => {
    // Excel no admite nombres de hoja de más de 31 caracteres.
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(h.data), h.nombre.slice(0, 31));
  });
  XLSX.writeFile(workbook, `${fileName}_${hoyArchivo()}.xlsx`);
};

/**
 * PDF con varias tablas, una tras otra, cada una con su subtítulo (SPEC-029).
 *
 * Se agregó sin tocar `exportToPDF`, que siguen usando las demás pestañas.
 */
export const exportToPDFSections = (
  title: string,
  secciones: { subtitulo: string; headers: string[]; rows: (string | number)[][] }[],
  fileName: string
) => {
  const conDatos = secciones.filter(s => s.rows && s.rows.length > 0);
  if (conDatos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 14, 22);

  let y = 30;
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
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
  });

  doc.save(`${fileName}_${hoyArchivo()}.pdf`);
};
