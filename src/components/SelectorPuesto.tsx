import React from 'react';
import { puestosDe } from '../utils/catalogos';
import type { Colaborador } from '../types/rrhh';

const OTRO = '__OTRO__';

/**
 * Desplegable de puesto, acotado al departamento elegido (SPEC-020).
 *
 * La lista sale del propio padrón, no de un catálogo escrito a mano, así que
 * se mantiene sola conforme cambia la plantilla. Como esa lista solo contiene
 * puestos que ya existen, hay una salida «Otro puesto» con captura libre: sin
 * ella no habría forma de contratar un puesto nuevo, que es precisamente lo que
 * pasa cuando se abre una plaza que nunca ha existido.
 */
export const SelectorPuesto: React.FC<{
  colaboradores: Colaborador[];
  departamento: string;
  valor: string;
  onChange: (valor: string) => void;
  required?: boolean;
  id?: string;
}> = ({ colaboradores, departamento, valor, onChange, required, id }) => {
  const opciones = puestosDe(colaboradores, departamento);

  /**
   * El puesto ya capturado se agrega a la lista aunque no figure entre los del
   * departamento. Pasa al editar a alguien cuyo puesto es único, o si le
   * cambian de área: sin esto, abrir su ficha le borraría el puesto en
   * silencio.
   */
  const actual = (valor || '').trim().toUpperCase();
  const lista = actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones;

  // Con «Otro» elegido, el valor escrito no está en la lista todavía; se
  // reconoce por la bandera y no por el contenido, que puede ir a medias.
  const [libre, setLibre] = React.useState(false);

  // Si el padre limpia el puesto (por ejemplo al cambiar de departamento), la
  // captura libre debe cerrarse sola; si no, quedaría una caja de texto vacía
  // pidiendo un puesto que ya nadie está capturando.
  React.useEffect(() => {
    if (!valor && libre) setLibre(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departamento]);

  /**
   * Limpiar el puesto al cambiar de departamento es tarea de quien pinta el
   * selector de departamento, no de aquí.
   *
   * Hacerlo dentro con un efecto parecía más cómodo, pero borraba el puesto al
   * abrir la ficha de alguien para editarla: cargar el formulario también
   * cambia el departamento, de vacío al de esa persona, y el efecto no puede
   * distinguir ese caso de un cambio hecho a mano. El resultado era que
   * consultar a un colaborador le vaciaba el puesto sin que nadie lo tocara.
   */

  if (!departamento) {
    return (
      <select disabled value="" style={{ width: '100%', color: 'var(--text-secondary)' }} id={id}>
        <option value="">Elige primero el departamento</option>
      </select>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <select
        id={id}
        required={required && !libre}
        value={libre ? OTRO : actual}
        onChange={(e) => {
          if (e.target.value === OTRO) { setLibre(true); onChange(''); }
          else { setLibre(false); onChange(e.target.value); }
        }}
        style={{ width: '100%' }}
      >
        <option value="">Selecciona el puesto…</option>
        {lista.map(p => <option key={p} value={p}>{p}</option>)}
        <option value={OTRO}>Otro puesto (escribirlo)</option>
      </select>

      {libre && (
        <input
          type="text"
          autoFocus
          required={required}
          placeholder="Nombre del puesto nuevo"
          value={valor}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: '100%' }}
        />
      )}
    </div>
  );
};
