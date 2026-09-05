import { useState } from 'react';
import { entrar, mensajeDeError } from '../services/suite';

/**
 * Pantalla de acceso (SPEC-001).
 *
 * Hasta esta versión la aplicación no tenía ningún control de acceso: cualquiera
 * con la dirección entraba y editaba el padrón del que dependen los inicios de
 * sesión de las cinco aplicaciones de la suite.
 */
export function LoginScreen() {
  const [nomina, setNomina] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!nomina.trim() || !clave) {
      setError('Escribe tu nómina y tu clave.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await entrar(nomina, clave);
      // El resto lo maneja el vigilante de sesión en App.
    } catch (e) {
      const codigo = (e as { code?: string }).code || '';
      setError(mensajeDeError(codigo));
      setClave('');
    } finally {
      setEnviando(false);
    }
  };

  const campo: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    fontFamily: 'inherit',
    border: '1px solid rgba(0,32,96,.15)',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#E8EEF8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '18px',
          boxShadow: '0 8px 30px rgba(0,32,96,.10)',
          padding: '2rem 1.75rem',
          width: '100%',
          maxWidth: '360px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              background: '#003580',
              color: '#fff',
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '.05em',
              margin: '0 auto .9rem'
            }}
          >
            IM
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#002060' }}>IMPREDIMEX</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#003580', marginTop: '2px' }}>
            Recursos Humanos
          </div>
        </div>

        <label style={{ fontSize: '12px', fontWeight: 600, color: '#5A6A80' }}>
          Número de nómina
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="username"
          value={nomina}
          onChange={e => setNomina(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('clave-input')?.focus()}
          style={{ ...campo, margin: '.35rem 0 .9rem' }}
        />

        <label style={{ fontSize: '12px', fontWeight: 600, color: '#5A6A80' }}>
          Clave de 6 dígitos
        </label>
        <div style={{ position: 'relative', margin: '.35rem 0 .25rem' }}>
          <input
            id="clave-input"
            type={verClave ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="current-password"
            value={clave}
            onChange={e => setClave(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviar()}
            style={{ ...campo, paddingRight: '46px' }}
          />
          <button
            type="button"
            onClick={() => setVerClave(v => !v)}
            title="Ver u ocultar"
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '6px'
            }}
          >
            👁
          </button>
        </div>

        {error && (
          <div
            style={{
              color: '#C8102E',
              fontSize: '12.5px',
              margin: '.5rem 0',
              lineHeight: 1.45
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={enviar}
          disabled={enviando}
          style={{
            width: '100%',
            marginTop: '1rem',
            padding: '13px',
            background: enviando ? '#5A6A80' : '#003580',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: enviando ? 'default' : 'pointer'
          }}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <div
          style={{
            fontSize: '11px',
            color: '#8A9AB0',
            textAlign: 'center',
            marginTop: '1.1rem',
            lineHeight: 1.5
          }}
        >
          Si olvidaste tu clave, pídele a un administrador que la restablezca.
        </div>
      </div>
    </div>
  );
}
