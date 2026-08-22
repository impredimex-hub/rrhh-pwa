import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Colaborador } from '../types/rrhh';
import { saveColaboradoresBatch, subscribeColaboradores, deleteColaborador } from '../services/personalService';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export const PersonalModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');
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
          nombreCompleto: String(row.Nombre || row.nombreCompleto || row.NombreCompleto || '').trim().toUpperCase(),
          departamento: String(row.Departamento || row.departamento || '').trim().toUpperCase(),
          puesto: String(row.Puesto || row.puesto || '').trim().toUpperCase(),
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

  const listaFiltrada = colaboradores.filter(c => 
    c.nombreCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
    c.noNomina.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.departamento && c.departamento.toLowerCase().includes(filtro.toLowerCase()))
  );

  const handleExportExcel = () => {
    const data = colaboradores.map(c => ({
      'No. Nómina': c.noNomina,
      'Nombre Completo': c.nombreCompleto,
      'Departamento': c.departamento || '-',
      'Puesto': c.puesto || '-',
      'Fecha de Ingreso': c.fechaIngreso || '-',
      'Estatus': c.estatus
    }));
    exportToExcel(data, 'IMPREDIMEX_Directorio_Personal');
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
    exportToPDF('IMPREDIMEX — Directorio de Personal', headers, rows, 'Directorio_Personal');
  };

  return (
    <div>
      {/* Cajas de Captura y Carga */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '1rem' }}>
        
        {/* Formulario Individual */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Registro Individual de Colaborador</div>
          </div>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="text" name="noNomina" placeholder="No. Nómina *" required
                value={formData.noNomina} onChange={handleInputChange}
              />
              <input
                type="text" name="nombreCompleto" placeholder="Nombre Completo *" required
                value={formData.nombreCompleto} onChange={handleInputChange}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="text" name="departamento" placeholder="Departamento (ej. TINTAS)"
                value={formData.departamento} onChange={handleInputChange}
              />
              <input
                type="text" name="puesto" placeholder="Puesto (ej. OPERADOR)"
                value={formData.puesto} onChange={handleInputChange}
              />
            </div>
            <input
              type="date" name="fechaIngreso"
              value={formData.fechaIngreso} onChange={handleInputChange}
            />
            <button type="submit" disabled={loading} className="btn-industrial-primary" style={{ width: '100%', marginTop: '4px' }}>
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
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
            Columnas requeridas en la cabecera: <code>NoNomina</code>, <code>Nombre</code>, <code>Departamento</code>, <code>Puesto</code>, <code>FechaIngreso</code>.
          </p>
          <div style={{ border: '2px dashed var(--border-mid)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,.5)' }}>
            <input
              type="file" accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload} disabled={loading}
              id="excel-upload" style={{ display: 'none' }}
            />
            <label htmlFor="excel-upload" style={{ cursor: 'pointer', color: 'var(--brand-navy)', fontWeight: 'bold', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <Upload size={24} />
              {loading ? 'Procesando archivo...' : 'Seleccionar plantilla Excel (.xlsx)'}
            </label>
          </div>
        </div>
      </div>

      {/* Tabla del Directorio */}
      <div className="card-industrial">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid var(--brand-navy-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Plantilla Registrada ({colaboradores.length})</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Buscar por nombre o nómina…"
              value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ width: '220px', padding: '6px 10px', fontSize: '12px' }}
            />
            <button onClick={handleExportExcel} className="btn-industrial-success">
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn-industrial-danger">
              <FileText size={15} /> PDF
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-industrial">
            <thead>
              <tr>
                <th>Nómina</th>
                <th>Nombre</th>
                <th>Departamento</th>
                <th>Puesto</th>
                <th>Ingreso</th>
                <th>Estatus</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                    Sin registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((colab) => (
                  <tr key={colab.noNomina}>
                    <td style={{ fontWeight: 'bold', color: 'var(--brand-navy)' }}>{colab.noNomina}</td>
                    <td style={{ fontWeight: 600 }}>{colab.nombreCompleto}</td>
                    <td>
                      {colab.departamento ? (
                        <span className="badge-industrial badge-navy">{colab.departamento}</span>
                      ) : '-'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{colab.puesto || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{colab.fechaIngreso || '-'}</td>
                    <td>
                      <span className={`badge-industrial ${colab.estatus === 'ACTIVO' ? 'badge-ok' : 'badge-nok'}`}>
                        {colab.estatus}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => deleteColaborador(colab.noNomina)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '4px' }}
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
