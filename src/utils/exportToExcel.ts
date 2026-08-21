import * as XLSX from 'xlsx';

export const exportarAExcel = (datos: any[], nombreArchivo: string, nombreHoja: string = 'Datos') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(datos);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);

  // Generar y descargar el archivo .xlsx
  XLSX.writeFile(workbook, `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
