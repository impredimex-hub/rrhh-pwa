import { useState, useEffect } from 'react';
import { Users, Award, ClipboardList, GraduationCap, TrendingUp, BookOpen, CalendarClock, WifiOff, Power, LayoutGrid } from 'lucide-react';
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

/** El portal de la suite, a donde lleva el botón de los cuatro cuadros. */
const URL_PORTAL = 'https://impredimex-hub.github.io/';

const ETIQUETA_PAPEL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAPTURA: 'Captura',
  CONSULTA: 'Consulta'
};

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad' | 'incidencias' | 'capacitacion' | 'promociones' | 'cursos' | 'sucesos'>('personal');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // Panel de la nómina (SPEC-035): en el teléfono es el único lugar donde el
  // nombre y el puesto caben completos.
  const [panelAbierto, setPanelAbierto] = useState(false);

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

      {/* Encabezado estándar de la suite (SPEC-035) */}
      <header style={{
        // Opaco y sin desenfoque: el encabezado no está fijo, así que el
        // efecto de cristal no tenía nada detrás que desenfocar. Lo único que
        // hacía era dejar pasar el fondo y, en iOS, lavar el logotipo.
        background: '#ffffff',
        borderBottom: '0.5px solid rgba(0,32,96,.08)',
        boxShadow: '0 2px 8px rgba(0,32,96,.05)',
        padding: '6px 12px',
        marginBottom: '1rem',
        // Fijo arriba, siempre visible (SPEC-035). Capa 45: por encima de los
        // menús desplegables del contenido (30) y por debajo de todas las
        // ventanas emergentes (50 en adelante).
        position: 'sticky',
        top: 0,
        zIndex: 45
      }}>
        {/* De borde a borde, sin la columna centrada del contenido: la marca
            va en la esquina izquierda y los botones en la derecha. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* Marca y aplicación. Alineadas a la izquierda: centrarlas las hacía
              pelear con los botones y en el teléfono quedaban corridas. */}
          {/* Las dos orillas crecen igual (flex 1 1 0), así lo de en medio
              queda centrado en la pantalla y no en el hueco que sobra. */}
          <div style={{ flex: '1 1 0' }}>
            <div className="hdr-marca">IMPREDIMEX</div>
            <div className="hdr-app">Recursos Humanos</div>
          </div>

          {/* Quién entró. Solo en pantalla ancha; en el teléfono va al panel.
              Centrado: nombre y puesto comparten eje, no orilla. */}
          <div className="hdr-identidad" style={{ flex: '0 1 auto', minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-navy-dark)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sesion.nombre}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-light)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sesion.puesto || (ETIQUETA_PAPEL[sesion.papel] ?? sesion.papel)}
            </div>
          </div>

          <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
            <a href={URL_PORTAL} className="hdr-boton" aria-label="Volver al portal" title="Volver al portal">
              <span><LayoutGrid size={15} /></span>
            </a>

            <button
              type="button"
              onClick={() => setPanelAbierto(v => !v)}
              aria-label={`Tu sesión: ${sesion.nombre}`}
              aria-expanded={panelAbierto}
              style={{ width: '44px', height: '44px', background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <span style={{ position: 'relative', width: '34px', height: '34px', display: 'block' }}>
                <span style={{ background: 'var(--brand-navy)', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11.5px', boxShadow: panelAbierto ? '0 0 0 3px rgba(0,53,128,.18)' : 'none' }}>
                  {sesion.nomina}
                </span>
                {/* El estado de conexión va aquí y no en su propio renglón: ahorra
                    todo un renglón de alto en el teléfono. */}
                <span
                  title={isOnline ? 'En línea' : 'Sin conexión'}
                  style={{ position: 'absolute', right: '-1px', bottom: '-1px', width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? 'var(--green)' : 'var(--brand-red)', border: '2px solid #fff', display: 'block' }}
                ></span>
              </span>
            </button>
          </div>
        </div>

        {/* Panel de la sesión. Aquí el nombre y el puesto tienen ancho completo
            y pueden ocupar dos renglones: ninguno se corta, mida lo que mida. */}
        {panelAbierto && (
          <>
            <div
              onClick={() => setPanelAbierto(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            ></div>
            <div style={{
              position: 'absolute', right: '12px', top: '100%', marginTop: '4px', zIndex: 41,
              width: '250px', background: '#fff', borderRadius: '14px',
              boxShadow: '0 2px 8px rgba(0,32,96,.10), 0 12px 32px rgba(0,32,96,.14)',
              padding: '14px 15px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-navy-dark)', lineHeight: 1.35 }}>
                {sesion.nombre}
              </div>
              {sesion.puesto && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                  {sesion.puesto}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? 'var(--green)' : 'var(--brand-red)', display: 'inline-block' }}></span>
                {isOnline ? 'En línea' : 'Sin conexión'}
                <span style={{ color: 'var(--border-mid)' }}>|</span>
                <span>Nómina {sesion.nomina}</span>
                <span style={{ color: 'var(--border-mid)' }}>|</span>
                <span>{ETIQUETA_PAPEL[sesion.papel] ?? sesion.papel}</span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-light)', margin: '12px 0' }}></div>

              <a href={URL_PORTAL} style={{ display: 'flex', alignItems: 'center', gap: '9px', minHeight: '44px', fontSize: '12.5px', fontWeight: 600, color: 'var(--brand-navy)', textDecoration: 'none' }}>
                <LayoutGrid size={16} /> Ir al portal
              </a>

              <button
                type="button"
                onClick={() => { salir().finally(() => window.location.reload()); }}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', minHeight: '44px', width: '100%', background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: 'var(--brand-red-dark)', textAlign: 'left', cursor: 'pointer' }}
              >
                <Power size={16} /> Cerrar sesión
              </button>
            </div>
          </>
        )}
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
