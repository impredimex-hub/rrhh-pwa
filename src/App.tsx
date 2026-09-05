import { useState, useEffect } from 'react';
import { Users, Award, ClipboardList, GraduationCap, BookOpen, WifiOff, LogOut } from 'lucide-react';
import { PersonalModule } from './components/PersonalModule';
import { AntiguedadVacantesModule } from './components/AntiguedadVacantesModule';
import { IncidenciasModule } from './components/IncidenciasModule';
import { CapacitacionModule } from './components/CapacitacionModule';
import { CursosModule } from './components/CursosModule';
import { LoginScreen } from './components/LoginScreen';
import { SesionContext } from './services/SesionContext';
import { armarSesion, vigilarSesion, salir, ErrorDeAcceso, type Sesion } from './services/suite';

const ETIQUETA_PAPEL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAPTURA: 'Captura',
  CONSULTA: 'Consulta'
};

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad' | 'incidencias' | 'capacitacion' | 'cursos'>('personal');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [avisoAcceso, setAvisoAcceso] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Vigila la sesión de Firebase. Cubre tanto el inicio de sesión desde la
  // pantalla de acceso como la restauración al recargar la página.
  useEffect(() => {
    return vigilarSesion(async user => {
      if (!user) {
        setSesion(null);
        setVerificando(false);
        return;
      }
      try {
        setSesion(await armarSesion(user));
        setAvisoAcceso('');
      } catch (e) {
        // Autenticado pero sin permiso para esta app: se cierra la sesión.
        setSesion(null);
        setAvisoAcceso(e instanceof ErrorDeAcceso ? e.message : 'No se pudo verificar tu acceso.');
        await salir().catch(() => {});
      } finally {
        setVerificando(false);
      }
    });
  }, []);

  if (verificando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8EEF8', color: '#5A6A80', fontSize: '13px' }}>
        Verificando tu sesión…
      </div>
    );
  }

  if (!sesion) {
    return (
      <>
        {avisoAcceso && (
          <div style={{ background: '#C8102E', color: '#fff', padding: '10px 14px', fontSize: '12.5px', textAlign: 'center', fontWeight: 600 }}>
            {avisoAcceso}
          </div>
        )}
        <LoginScreen />
      </>
    );
  }

  const navItems = [
    { id: 'personal', label: 'Directorio', icon: Users },
    { id: 'antiguedad', label: 'Antigüedad y Vacantes', icon: Award },
    { id: 'incidencias', label: 'Incidencias', icon: ClipboardList },
    { id: 'capacitacion', label: 'Capacitación', icon: GraduationCap },
    { id: 'cursos', label: 'Cursos', icon: BookOpen },
  ];

  return (
    <SesionContext.Provider value={sesion}>
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9ff', paddingBottom: '30px' }}>
      {/* Offline Alert Strip */}
      {!isOnline && (
        <div style={{ background: 'var(--brand-red)', color: '#fff', padding: '6px 12px', fontSize: '11px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold', letterSpacing: '.04em' }}>
          <WifiOff size={14} /> MODO OFFLINE — Los cambios se sincronizarán con Firebase al recuperar conexión.
        </div>
      )}

      {/* IMPREDIMEX Frosted Header */}
      <header style={{
        background: 'rgba(255,255,255,.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(0,32,96,.08)',
        boxShadow: '0 2px 8px rgba(0,32,96,.05)',
        padding: '0.75rem 1.5rem',
        marginBottom: '1rem'
      }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'var(--brand-navy)', color: '#fff', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', letterSpacing: '.05em' }}>
              IM
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--brand-navy-dark)', letterSpacing: '.02em' }}>IMPREDIMEX</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '.01em' }}>Sistema de Gestión de Recursos Humanos</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#8A9AB0', marginTop: '2px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#4ADE80' : '#c0392b', display: 'inline-block' }}></span>
                {isOnline ? 'En línea' : 'Sin conexión'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right', lineHeight: 1.4 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-navy-dark)' }} title={sesion.nombre}>
                {sesion.nomina}
              </div>
              <div style={{ fontSize: '11px', color: '#8A9AB0' }}>
                {ETIQUETA_PAPEL[sesion.papel] ?? sesion.papel}
              </div>
            </div>
            <button
              onClick={() => { salir().finally(() => window.location.reload()); }}
              title="Cerrar sesión"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid rgba(0,32,96,.15)', borderRadius: '8px', padding: '7px 11px', fontSize: '11.5px', fontWeight: 600, fontFamily: 'inherit', color: 'var(--brand-navy)', cursor: 'pointer' }}
            >
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '0 1rem' }}>

        {/* Floating Tabs Bar */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,.98)',
          outline: '0.5px solid rgba(0,32,96,.06)',
          boxShadow: 'var(--shadow-sm)',
          padding: '0 8px',
          marginBottom: '1rem',
          overflowX: 'auto'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const activo = pestanaActiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPestanaActiva(item.id as any)}
                style={{
                  flex: 1,
                  padding: '12px 10px 10px',
                  border: 'none',
                  borderBottom: activo ? '2px solid var(--brand-navy)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  fontWeight: activo ? 700 : 500,
                  color: activo ? 'var(--brand-navy-dark)' : '#8A9AB0',
                  letterSpacing: '.03em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all .2s'
                }}
              >
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Views */}
        <main>
          {pestanaActiva === 'personal' && <PersonalModule />}
          {pestanaActiva === 'antiguedad' && <AntiguedadVacantesModule />}
          {pestanaActiva === 'incidencias' && <IncidenciasModule />}
          {pestanaActiva === 'capacitacion' && <CapacitacionModule />}
          {pestanaActiva === 'cursos' && <CursosModule />}
        </main>

        <footer style={{ textAlign: 'center', padding: '1.2rem', fontSize: '11px', color: 'var(--text-light)', borderTop: '1px solid var(--border-light)', marginTop: '2rem' }}>
          <strong style={{ color: 'var(--brand-navy)' }}>IMPREDIMEX</strong> — Impresión y Diseño de México S.A. de C.V. &nbsp;·&nbsp; Sistema Integral de Recursos Humanos
        </footer>
      </div>
    </div>
    </SesionContext.Provider>
  );
}

export default App;
