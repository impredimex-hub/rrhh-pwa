import { useState } from 'react';
import { Users, Award } from 'lucide-react';
import { PersonalModule } from './components/PersonalModule';
import { AntiguedadVacantesModule } from './components/AntiguedadVacantesModule';

function App() {
  const [pestanaActiva, setPestanaActiva] = useState<'personal' | 'antiguedad'>('personal');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
            RH Industrial App
          </h1>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPestanaActiva('personal')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                background: pestanaActiva === 'personal' ? '#2563eb' : 'transparent',
                color: pestanaActiva === 'personal' ? '#ffffff' : '#64748b'
              }}
            >
              <Users size={16} /> Directorio de Personal
            </button>
            <button
              onClick={() => setPestanaActiva('antiguedad')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                background: pestanaActiva === 'antiguedad' ? '#2563eb' : 'transparent',
                color: pestanaActiva === 'antiguedad' ? '#ffffff' : '#64748b'
              }}
            >
              <Award size={16} /> Antigüedad y Vacantes
            </button>
          </nav>
        </div>
      </header>

      <main style={{ padding: '20px 0' }}>
        {pestanaActiva === 'personal' && <PersonalModule />}
        {pestanaActiva === 'antiguedad' && <AntiguedadVacantesModule />}
      </main>
    </div>
  );
}

export default App;
