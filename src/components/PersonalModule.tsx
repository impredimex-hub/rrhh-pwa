import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Colaborador } from '../types/rrhh';
import { saveColaboradoresBatch, subscribeColaboradores, deleteColaborador } from '../services/personalService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const PersonalModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
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
      setColaboradores(data);
    });
    return () => unsubscribe();
  }, []);

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

    try {
      setLoading(true);
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
    } catch (error) {
      alert('Error al guardar el colaborador');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setLoading(true);
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        const colaboradoresProcesados: Colaborador[] = rawData.map((row) => ({
          noNomina: String(row.NoNomina || row.Nomina || row.noNomina || '').trim(),
          nombreCompleto: String(row.Nombre || row.nombreCompleto || row.NombreCompleto || '').trim(),
          departamento: String(row.Departamento || row.departamento || '').trim(),
          puesto: String(row.Puesto || row.puesto || '').trim(),
          fechaIngreso: row.FechaIngreso || row.fechaIngreso ? String(row.FechaIngreso || row.fechaIngreso).trim() : '',
          estatus: (row.Estatus || row.estatus || 'ACTIVO').toUpperCase()
        })).filter(c => c.noNomina && c.nombreCompleto);

        if (colaboradoresProcesados.length === 0) {
          alert('No se encontraron registros válidos en el archivo.');
          return;
        }

        await saveColaboradoresBatch(colaboradoresProcesados);
        alert(`Se importaron ${colaboradoresProcesados.length} colaboradores exitosamente.`);
      } catch (error) {
        alert('Error al procesar el archivo Excel.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const data = colaboradores.map(c => ({
      'No. Nómina': c.noNomina,
      'Nombre Completo': c.nombreCompleto,
      'Departamento': c.departamento || '-',
      'Puesto': c.puesto || '-',
      'Fecha de Ingreso': c.fechaIngreso || '-',
      'Estatus': c.estatus
    }));
    exportToExcel(data, 'Reporte_Personal_Activo');
  };

  const handleExportPDF = () => {
    const headers = ['Nómina', 'Nombre Completo', 'Departamento', 'Puesto', 'Ingreso', 'Estatus'];
    const rows = colaboradores.map(c => [
      c.noNomina,
      c.nombreCompleto,
      c.departamento || '-',
      c.puesto || '-',
      c.fechaIngreso || '-',
      c.estatus
    ]);
    exportToPDF('Directorio Oficial de Personal', headers, rows, 'Directorio_Personal');
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eaeaea', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#1a1a1a' }}>Directorio de Personal</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
          <button
            onClick={handleExportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            <FileText size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {/* Formulario Individual */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={18} /> Registro Individual
          </h3>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text" name="noNomina" placeholder="No. Nómina *" required
              value={formData.noNomina} onChange={handleInputChange}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text" name="nombreCompleto" placeholder="Nombre Completo *" required
              value={formData.nombreCompleto} onChange={handleInputChange}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text" name="departamento" placeholder="Departamento (ej. Impresión)"
              value={formData.departamento} onChange={handleInputChange}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text" name="puesto" placeholder="Puesto (ej. Impresor)"
              value={formData.puesto} onChange={handleInputChange}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="date" name="fechaIngreso"
              value={formData.fechaIngreso} onChange={handleInputChange}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <button
              type="submit" disabled={loading}
              style={{ padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Guardando...' : 'Guardar Colaborador'}
            </button>
          </form>
        </div>

        {/* Carga Masiva */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={18} /> Carga Masiva desde Excel
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Columnas admitidas: <code>NoNomina</code>, <code>Nombre</code>, <code>Departamento</code>, <code>Puesto</code>, <code>FechaIngreso</code>.
          </p>
          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '6px', padding: '24px', textAlign: 'center', marginTop: '16px' }}>
            <input
              type="file" accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload} disabled={loading}
              id="excel-upload" style={{ display: 'none' }}
            />
            <label htmlFor="excel-upload" style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 'bold' }}>
              {loading ? 'Procesando archivo...' : 'Seleccionar archivo Excel'}
            </label>
          </div>
        </div>
      </div>

      {/* Directorio de Colaboradores */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Plantilla Registrada ({colaboradores.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Nómina</th>
                <th style={{ padding: '10px' }}>Nombre</th>
                <th style={{ padding: '10px' }}>Departamento</th>
                <th style={{ padding: '10px' }}>Puesto</th>
                <th style={{ padding: '10px' }}>Ingreso</th>
                <th style={{ padding: '10px' }}>Estatus</th>
                <th style={{ padding: '10px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay colaboradores registrados.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => (
                  <tr key={colab.noNomina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{colab.noNomina}</td>
                    <td style={{ padding: '10px' }}>{colab.nombreCompleto}</td>
                    <td style={{ padding: '10px' }}>{colab.departamento || '-'}</td>
                    <td style={{ padding: '10px' }}>{colab.puesto || '-'}</td>
                    <td style={{ padding: '10px' }}>{colab.fechaIngreso || '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: colab.estatus === 'ACTIVO' ? '#dcfce7' : '#fee2e2', color: colab.estatus === 'ACTIVO' ? '#15803d' : '#b91c1c' }}>
                        {colab.estatus}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => deleteColaborador(colab.noNomina)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                        title="Eliminar colaborador"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
