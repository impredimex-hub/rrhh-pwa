import { useState } from 'react';
import { Users, Award, ClipboardList, GraduationCap } from 'lucide-react';
import { PersonalModule } from './components/PersonalModule';
import { AntiguedadVacantesModule } from './components/AntiguedadVacantesModule';
import { IncidenciasModule } from './components/IncidenciasModule';
import { CapacitacionModule } from './components/CapacitacionModule';

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad' | 'incidencias' | 'capacitacion'>('personal');

  const navItems = [
    { id: 'personal', label: 'Directorio', icon: Users },
    { id: 'antiguedad', label: 'Antigüedad y Vacantes', icon: Award },
    { id: 'incidencias', label: 'Incidencias', icon: ClipboardList },
    { id: 'capacitacion', label: 'Capacitación', icon: GraduationCap },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
            RH Industrial App
          </h1>
          <nav style={{ display: 'flex', gap: '6px' }}>
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
