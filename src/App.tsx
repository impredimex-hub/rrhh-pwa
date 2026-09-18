import { useState, useEffect } from 'react';
import { Users, Award, ClipboardList, GraduationCap, TrendingUp, BookOpen, CalendarClock, WifiOff, Power } from 'lucide-react';
import { PersonalModule } from './components/PersonalModule';
import { AntiguedadVacantesModule } from './components/AntiguedadVacantesModule';
import { IncidenciasModule } from './components/IncidenciasModule';
import { CapacitacionModule } from './components/CapacitacionModule';
import { PromocionesModule } from './components/PromocionesModule';
import { CursosModule } from './components/CursosModule';
import { SucesosTurnosModule } from './components/SucesosTurnosModule';
import { LoginScreen } from './components/LoginScreen';
import { SesionContext } from './services/SesionContext';
import { armarSesion, vigilarSesion, salir, ErrorDeAcceso, type Sesion } from './services/suite';

const ETIQUETA_PAPEL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAPTURA: 'Captura',
  CONSULTA: 'Consulta'
};

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad' | 'incidencias' | 'capacitacion' | 'promociones' | 'cursos' | 'sucesos'>('personal');
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
    // A la derecha de Capacitación, de donde salió (SPEC-024).
    { id: 'promociones', label: 'Promociones', icon: TrendingUp },
    { id: 'cursos', label: 'Cursos', icon: BookOpen },
    { id: 'sucesos', label: 'Sucesos y Turnos', icon: CalendarClock },
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
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Bloque central: marca, aplicación y quién entró */}
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--brand-navy-dark)', letterSpacing: '.02em' }}>
              IMPREDIMEX
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-navy)', marginTop: '1px' }}>
              Sistema de Gestión de Recursos Humanos
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-navy-dark)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '.01em' }}>
              {sesion.nombre}
            </div>
            {/* Si el padrón no trae puesto se cae al papel, para no dejar el
                hueco vacío ni desalinear el encabezado. */}
            <div style={{ fontSize: '12px', color: '#8A9AB0', textTransform: 'uppercase', letterSpacing: '.01em' }}>
              {sesion.puesto || (ETIQUETA_PAPEL[sesion.papel] ?? sesion.papel)}
            </div>
          </div>

          {/* Bloque derecho: nómina, salir y estado de conexión */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                title={`Nómina ${sesion.nomina} · ${ETIQUETA_PAPEL[sesion.papel] ?? sesion.papel}`}
                style={{ background: 'var(--brand-navy)', color: '#fff', width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}
              >
                {sesion.nomina}
              </div>
              <button
                onClick={() => { salir().finally(() => window.location.reload()); }}
                title="Cerrar sesión"
                style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'transparent', border: '1px solid rgba(0,32,96,.15)', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                <Power size={19} />
              </button>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#8A9AB0' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#4ADE80' : '#c0392b', display: 'inline-block' }}></span>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </div>
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
          {pestanaActiva === 'promociones' && <PromocionesModule />}
          {pestanaActiva === 'cursos' && <CursosModule />}
          {pestanaActiva === 'sucesos' && <SucesosTurnosModule />}
        </main>
      </div>
    </div>
    </SesionContext.Provider>
  );
}

export default App;
