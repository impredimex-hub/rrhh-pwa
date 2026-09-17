import React from 'react';
import type { Colaborador } from '../types/rrhh';

/**
 * Buscador de colaborador con sugerencias (SPEC-021).
 *
 * Sustituye al desplegable porque el padrón pasa de cien personas: en un
 * teléfono, esa lista obliga a girar una rueda enorme hasta dar con el nombre.
 * Aquí se escribe parte del nombre o de la nómina y se elige de los resultados.
 *
 * La nómina elegida se guarda aparte del texto escrito, para que un nombre
 * tecleado a medias nunca se confunda con una selección hecha.
 */
export const AutocompletarColaborador: React.FC<{
  colaboradores: Colaborador[];
  valor: string;
  onChange: (noNomina: string) => void;
  required?: boolean;
  placeholder?: string;
}> = ({ colaboradores, valor, onChange, required, placeholder = 'Escribe nombre o nómina…' }) => {
  const elegido = colaboradores.find(c => String(c.noNomina).trim() === String(valor).trim());

  const [texto, setTexto] = React.useState('');
  const [abierto, setAbierto] = React.useState(false);
  const caja = React.useRef<HTMLDivElement>(null);

  // Cuando el formulario se limpia desde fuera, el texto también debe irse; si
  // no, quedaría el nombre anterior escrito sin nadie seleccionado detrás.
  React.useEffect(() => {
    if (!valor) setTexto('');
  }, [valor]);

  // Un clic fuera cierra la lista. Sin esto se queda abierta tapando el resto
  // del formulario, que en el teléfono es casi toda la pantalla.
  React.useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const busqueda = texto.trim().toLowerCase();
  const sugerencias = colaboradores
    .filter(c => c.estatus !== 'BAJA')
    .filter(c =>
      !busqueda ||
      c.nombreCompleto.toLowerCase().includes(busqueda) ||
      String(c.noNomina).toLowerCase().includes(busqueda)
    )
    .slice(0, 8);

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <input
        type="text"
        // El campo obligatorio se satisface con la nómina elegida, no con lo
        // escrito: así no se puede enviar un nombre tecleado que no existe.
        required={required && !elegido}
        placeholder={placeholder}
        value={elegido ? `${elegido.noNomina} - ${elegido.nombreCompleto}` : texto}
        onChange={e => {
          setTexto(e.target.value);
          setAbierto(true);
          // Escribir encima de una selección la deshace: lo que se ve y lo que
          // se va a guardar tienen que ser lo mismo.
          if (elegido) onChange('');
        }}
        onFocus={() => setAbierto(true)}
        style={{ width: '100%' }}
      />

      {abierto && !elegido && sugerencias.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
          background: '#fff', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)',
          marginTop: '2px', maxHeight: '190px', overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,32,96,.12)'
        }}>
          {sugerencias.map(c => (
            <button
              key={c.noNomina}
              type="button"
              onClick={() => { onChange(String(c.noNomina).trim()); setTexto(''); setAbierto(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                padding: '7px 10px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)'
              }}
            >
              <b style={{ color: 'var(--brand-navy)' }}>{c.noNomina}</b> — {c.nombreCompleto}
              <span style={{ color: 'var(--text-secondary)' }}> ({c.departamento || 'sin departamento'})</span>
            </button>
          ))}
        </div>
      )}

      {/* El aviso de «sin coincidencias» va en el flujo normal, no flotando.
          Flotando tapaba el botón de abrir evaluación, que queda justo debajo:
          el recuadro interceptaba el toque y el botón se volvía intocable. */}
      {abierto && !elegido && busqueda.length > 0 && sugerencias.length === 0 && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>
          Nadie coincide con esa búsqueda.
        </div>
      )}
    </div>
  );
};
