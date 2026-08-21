import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Exportar a Excel
export const exportToExcel = (data: Record<string, any>[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
};
