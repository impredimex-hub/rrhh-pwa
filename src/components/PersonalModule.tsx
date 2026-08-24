import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Trash2, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Colaborador } from '../types/rrhh';
import { saveColaboradoresBatch, subscribeColaboradores, deleteColaborador, ordenarPorNomina } from '../services/personalService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const PersonalModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 30;

  const [formData, setFormData] = useState<Partial<Colaborador>>({
    noNomina: '',
    nombreCompleto: '',
    departamento: '',
    puesto: '',
    fechaIngreso: '',
    estatus: 'ACTIVO'
  });

  useEffect(() => {
    const unsubscribe = subscribeColaboradores((data) => {
      setColaboradores(ordenarPorNomina(data));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.noNomina || !formData.nombreCompleto) {
      alert('Número de nómina y Nombre completo son obligatorios');
      return;
    }

    setLoading(true);
    try {
      await saveColaboradoresBatch([formData as Colaborador]);
      setFormData({
        noNomina: '',
        nombreCompleto: '',
        departamento: '',
        puesto: '',
        fechaIngreso: '',
        estatus: 'ACTIVO'
      });
      alert('Colaborador guardado con éxito');
    } catch (error: any) {
      alert('Error al guardar: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const formatearFechaExcel = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      const date = new Date((val - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
        return `${anio}-${mes}-${dia}`;
      }
    }
    return str;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        const colaboradoresProcesados: Colaborador[] = rawData.map((row) => {
          const nominaVal = row['# NOMINA'] || row['#NOMINA'] || row['NOMINA'] || row['NoNomina'] || row['No. Nomina'] || '';
          const nombreVal = row['NOMBRE'] || row['Nombre'] || row['NombreCompleto'] || '';
          const puestoVal = row['PUESTO'] || row['Puesto'] || '';
          const ingresoVal = row['INGRESO'] || row['Ingreso'] || row['FECHA INGRESO'] || row['FechaIngreso'] || '';
          const deptoVal = row['DEPARTAMENTO'] || row['Departamento'] || row['DEPTO'] || '';

          return {
            noNomina: String(nominaVal).trim(),
            nombreCompleto: String(nombreVal).trim().toUpperCase(),
            puesto: String(puestoVal).trim().toUpperCase(),
            fechaIngreso: formatearFechaExcel(ingresoVal),
            departamento: String(deptoVal).trim().toUpperCase(),
            estatus: 'ACTIVO'
          };
        }).filter(c => c.noNomina && c.nombreCompleto);

        if (colaboradoresProcesados.length === 0) {
          alert('No se encontraron registros válidos. Columnas requeridas: # NOMINA, NOMBRE, PUESTO, INGRESO, DEPARTAMENTO.');
        } else {
          await saveColaboradoresBatch(colaboradoresProcesados);
          alert(`Se importaron ${colaboradoresProcesados.length} colaboradores exitosamente.`);
        }
      } catch (error: any) {
        alert('Error al procesar el archivo Excel: ' + (error?.message || 'Error desconocido'));
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('Error de lectura del archivo.');
      setLoading(false);
      e.target.value = '';
    };

    reader.readAsBinaryString(file);
  };

  const listaFiltrada = ordenarPorNomina(
    colaboradores.filter(c => 
      c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
      c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase())) ||
      (c.puesto && c.puesto.toLowerCase().includes(filtro.toLowerCase()))
    )
  );

  const totalPaginas = Math.ceil(listaFiltrada.length / elementosPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * elementosPorPagina;
  const colaboradoresPaginados = listaFiltrada.slice(indexInicio, indexInicio + elementosPorPagina);

  // Exportar exactamente lo filtrado en pantalla
  const handleExportExcel = () => {
    const data = listaFiltrada.map(c => ({
      '# NOMINA': c.noNomina,
      'NOMBRE': c.nombreCompleto,
      'PUESTO': c.puesto || '-',
      'INGRESO': c.fechaIngreso || '-',
      'DEPARTAMENTO': c.departamento || '-',
      'ESTATUS': c.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Plantilla_Registrada');
  };

  const handleExportPDF = () => {
    const headers = ['# Nómina', 'Nombre', 'Puesto', 'Ingreso', 'Departamento', 'Estatus'];
    const rows = listaFiltrada.map(c => [
      c.noNomina,
      c.nombreCompleto,
      c.puesto || '-',
      c.fechaIngreso || '-',
      c.departamento || '-',
      c.estatus
    ]);
    exportToPDF('IMPREDIMEX — Plantilla Registrada', headers, rows, 'Plantilla_Registrada');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        
        {/* Formulario Individual */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Registro Individual de Colaborador</div>
          </div>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text" name="noNomina" placeholder="# Nómina *" required
                value={formData.noNomina} onChange={handleInputChange}
                style={{ flex: 1 }}
              />
              <input
                type="text" name="nombreCompleto" placeholder="Nombre *" required
                value={formData.nombreCompleto} onChange={handleInputChange}
                style={{ flex: 1.5 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text" name="puesto" placeholder="Puesto (ej. OPERADOR)"
                value={formData.puesto} onChange={handleInputChange}
                style={{ flex: 1.2 }}
              />
              <input
                type="date" name="fechaIngreso"
                value={formData.fechaIngreso} onChange={handleInputChange}
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="text" name="departamento" placeholder="Departamento (ej. TINTAS)"
              value={formData.departamento} onChange={handleInputChange}
            />
            <button type="submit" disabled={loading} className="btn-industrial-primary" style={{ marginTop: '4px' }}>
              <UserPlus size={16} /> {loading ? 'Guardando…' : 'Guardar Colaborador'}
            </button>
          </form>
        </div>

        {/* Carga Masiva */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Carga Masiva desde Archivo Excel</div>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '14px' }}>
            Columnas requeridas: <code># NOMINA</code>, <code>NOMBRE</code>, <code>PUESTO</code>, <code>INGRESO</code>, <code>DEPARTAMENTO</code>.
          </p>
          <div style={{ border: '2px dashed var(--border-mid)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', background: '#fff' }}>
            <input
              type="file" accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload} disabled={loading}
              id="excel-upload" style={{ display: 'none' }}
            />
            <label htmlFor="excel-upload" style={{ cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 'bold', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <Upload size={22} />
              {loading ? 'Procesando archivo...' : 'Seleccionar plantilla Excel (.xlsx)'}
            </label>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Plantilla Registrada ({listaFiltrada.length})</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Buscar colaborador…"
              value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ width: '150px', height: '30px', padding: '4px 8px', fontSize: '10px' }}
            />
            <button onClick={handleExportExcel} className="btn-industrial-success" style={{ height: '30px' }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn-industrial-danger" style={{ height: '30px' }}>
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '9.5px', lineHeight: '1.2' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}># Nómina</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Puesto</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Ingreso</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Departamento</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Estatus</th>
                <th style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 'bold', color: 'var(--brand-navy)', textTransform: 'uppercase' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                    Sin registros que coincidan.
                  </td>
                </tr>
              ) : (
                colaboradoresPaginados.map((colab) => (
                  <tr key={colab.noNomina} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{colab.nombreCompleto}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{colab.fechaIngreso || '-'}</td>
                    <td style={{ padding: '5px 8px' }}>
                      {colab.departamento ? (
                        <span style={{ display: 'inline-block', background: 'var(--brand-navy-light)', color: 'var(--brand-navy)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                          {colab.departamento}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ display: 'inline-block', background: colab.estatus === 'ACTIVO' ? 'var(--green-light)' : 'var(--red-light)', color: colab.estatus === 'ACTIVO' ? 'var(--green-dark)' : 'var(--brand-red)', fontSize: '8.5px', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                        {colab.estatus}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <button
                        onClick={() => deleteColaborador(colab.noNomina)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                        title="Eliminar colaborador"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
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
    </div>
  );
};
