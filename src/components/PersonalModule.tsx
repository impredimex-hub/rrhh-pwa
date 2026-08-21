import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Users, Upload, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import type { Colaborador } from '../types/rrhh';
import { subscribeColaboradores, saveColaborador, batchUploadColaboradores } from '../services/personalService';

export const PersonalModule: React.FC = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const [form, setForm] = useState<Colaborador>({
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

  const handleGuardarManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.noNomina.trim() || !form.nombreCompleto.trim()) {
      alert('Por favor ingresa al menos el Número de Nómina y el Nombre Completo.');
      return;
    }

    const datosAGuardar = { ...form };

    // Limpia campos inmediatamente
    setForm({
      noNomina: '',
      nombreCompleto: '',
      departamento: '',
      puesto: '',
      fechaIngreso: '',
      estatus: 'ACTIVO'
    });

    // Enviar a Firestore sin bloquear el botón
    saveColaborador(datosAGuardar)
      .then(() => {
        setMensaje({ tipo: 'exito', texto: 'Colaborador guardado correctamente.' });
      })
      .catch((error: any) => {
        console.error('Error al guardar:', error);
        setMensaje({ tipo: 'error', texto: `Error: ${error.message}` });
      });
  };

  const handleCargaExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setGuardando(true);
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

        const listaParseada: Colaborador[] = jsonData.map((row) => ({
          noNomina: String(row['NoNomina'] || row['Nomina'] || row['noNomina'] || row['ID'] || '').trim(),
          nombreCompleto: String(row['Nombre'] || row['NombreCompleto'] || row['nombreCompleto'] || '').trim(),
          departamento: String(row['Departamento'] || row['departamento'] || 'GENERAL').trim(),
          puesto: String(row['Puesto'] || row['puesto'] || 'OPERADOR').trim(),
          fechaIngreso: String(row['FechaIngreso'] || row['fechaIngreso'] || new Date().toISOString().split('T')[0]).trim(),
          estatus: 'ACTIVO'
        })).filter(c => c.noNomina !== '' && c.nombreCompleto !== '');

        if (listaParseada.length === 0) {
          setMensaje({ tipo: 'error', texto: 'No se encontraron registros válidos en el archivo Excel.' });
          setGuardando(false);
          return;
        }

        await batchUploadColaboradores(listaParseada);
        setMensaje({ tipo: 'exito', texto: `Se importaron ${listaParseada.length} colaboradores con éxito.` });
      } catch (error: any) {
        setMensaje({ tipo: 'error', texto: `Error Excel: ${error.message}` });
      } finally {
        setGuardando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '12px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#1a1a1a' }}>
          <Users size={24} /> Directorio de Personal
        </h2>
      </div>

      {mensaje && (
        <div style={{
          marginTop: '15px', padding: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px',
          background: mensaje.tipo === 'exito' ? '#e6f4ea' : '#fce8e6',
          color: mensaje.tipo === 'exito' ? '#137333' : '#c5221f'
        }}>
          {mensaje.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={18} /> Registro Individual
          </h3>
          <form onSubmit={handleGuardarManual} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text" placeholder="No. Nómina *" required value={form.noNomina}
              onChange={(e) => setForm({ ...form, noNomina: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="text" placeholder="Nombre Completo *" required value={form.nombreCompleto}
              onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="text" placeholder="Departamento (ej. Impresión)" value={form.departamento}
              onChange={(e) => setForm({ ...form, departamento: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="text" placeholder="Puesto (ej. Impresor)" value={form.puesto}
              onChange={(e) => setForm({ ...form, puesto: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="date" value={form.fechaIngreso}
              onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button
              type="submit"
              style={{ padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Guardar Colaborador
            </button>
          </form>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={18} /> Carga Masiva desde Excel
          </h3>
          <p style={{ fontSize: '13px', color: '#555', marginTop: 0 }}>
            Columnas: <code>NoNomina</code>, <code>Nombre</code>, <code>Departamento</code>, <code>Puesto</code>, <code>FechaIngreso</code>.
          </p>
          <div style={{ border: '2px dashed #ccc', padding: '24px', textAlign: 'center', borderRadius: '6px', background: '#fff' }}>
            <input
              type="file" accept=".xlsx, .xls, .csv" onChange={handleCargaExcel} disabled={guardando}
              style={{ display: 'none' }} id="excel-upload"
            />
            <label htmlFor="excel-upload" style={{ cursor: 'pointer', color: '#1a73e8', fontWeight: 'bold' }}>
              {guardando ? 'Procesando archivo...' : 'Seleccionar archivo Excel'}
            </label>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', margin: '0 0 10px 0' }}>Plantilla Registrada ({colaboradores.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '10px' }}>Nómina</th>
                <th style={{ padding: '10px' }}>Nombre</th>
                <th style={{ padding: '10px' }}>Departamento</th>
                <th style={{ padding: '10px' }}>Puesto</th>
                <th style={{ padding: '10px' }}>Ingreso</th>
                <th style={{ padding: '10px' }}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay colaboradores registrados.
                  </td>
                </tr>
              ) : (
                colaboradores.map((colab) => (
                  <tr key={colab.noNomina} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{colab.noNomina}</td>
                    <td style={{ padding: '10px' }}>{colab.nombreCompleto}</td>
                    <td style={{ padding: '10px' }}>{colab.departamento}</td>
                    <td style={{ padding: '10px' }}>{colab.puesto}</td>
                    <td style={{ padding: '10px' }}>{colab.fechaIngreso || '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                        background: colab.estatus === 'ACTIVO' ? '#e6f4ea' : '#fce8e6',
                        color: colab.estatus === 'ACTIVO' ? '#137333' : '#c5221f'
                      }}>
                        {colab.estatus}
                      </span>
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