import { useState, useEffect } from 'react';
import { Users, Award, ClipboardList, GraduationCap, Wifi, WifiOff } from 'lucide-react';
import { PersonalModule } from './components/PersonalModule';
import { AntiguedadVacantesModule } from './components/AntiguedadVacantesModule';
import { IncidenciasModule } from './components/IncidenciasModule';
import { CapacitacionModule } from './components/CapacitacionModule';

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad' | 'incidencias' | 'capacitacion'>('personal');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  const navItems = [
    { id: 'personal', label: 'Directorio', icon: Users },
    { id: 'antiguedad', label: 'Antigüedad y Vacantes', icon: Award },
    { id: 'incidencias', label: 'Incidencias', icon: ClipboardList },
    { id: 'capacitacion', label: 'Capacitación', icon: GraduationCap },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Barra de estado de conexión */}
      {!isOnline && (
        <div style={{ background: '#ea580c', color: '#fff', padding: '6px 12px', fontSize: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold' }}>
          <WifiOff size={16} /> Modo Sin Conexión (Offline): Los cambios se guardarán localmente y se sincronizarán al recuperar la red.
        </div>
      )}

      {/* Barra superior de navegación */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '60px', flexWrap: 'wrap', gap: '10px', padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
              RH Industrial App
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
              background: isOnline ? '#e6f4ea' : '#fee2e2',
              color: isOnline ? '#137333' : '#b91c1c'
            }}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const activo = pestanaActiva === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPestanaActiva(item.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    background: activo ? '#2563eb' : 'transparent',
                    color: activo ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <main style={{ padding: '20px 0' }}>
        {pestanaActiva === 'personal' && <PersonalModule />}
        {pestanaActiva === 'antiguedad' && <AntiguedadVacantesModule />}
        {pestanaActiva === 'incidencias' && <IncidenciasModule />}
        {pestanaActiva === 'capacitacion' && <CapacitacionModule />}
      </main>
    </div>
  );
}

export default App;
