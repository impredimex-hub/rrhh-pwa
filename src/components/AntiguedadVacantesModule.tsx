      {/* SECCIÓN 2: CONTROL DE VACANTES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginTop: '1rem' }}>
        
        {/* Formulario */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Abrir Nueva Vacante</div>
          </div>
          <form onSubmit={handleCrearVacante} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text" placeholder="Departamento (ej. FLEXOGRAFÍA)" required value={formVacante.departamento}
              onChange={(e) => setFormVacante({ ...formVacante, departamento: e.target.value })}
            />
            <input
              type="text" placeholder="Puesto (ej. AYUDANTE GENERAL)" required value={formVacante.puesto}
              onChange={(e) => setFormVacante({ ...formVacante, puesto: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>REQUERIDAS</label>
                <input
                  type="number" min="1" required value={formVacante.cantidadRequerida}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadRequerida: Number(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '10px', color: 'var(--brand-navy)', fontWeight: 'bold' }}>CUBIERTAS</label>
                <input
                  type="number" min="0" required value={formVacante.cantidadCubierta}
                  onChange={(e) => setFormVacante({ ...formVacante, cantidadCubierta: Number(e.target.value) })}
                />
              </div>
            </div>
            <button type="submit" className="btn-industrial-primary" style={{ marginTop: '6px' }}>
              <Plus size={16} /> Registrar Vacante
            </button>
          </form>
        </div>

        {/* Tablero */}
        <div className="card-industrial">
          <div className="card-title-bar">
            <div className="bar-accent"></div>
            <div className="sec-title" style={{ margin: 0 }}>Estado de Plazas ({vacantes.length})</div>
          </div>
          {vacantes.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '2rem 0' }}>
              No hay vacantes abiertas actualmente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vacantes.map((v) => {
                const badgeBg = v.estatus === 'CUBIERTA' ? 'var(--green-light)' : v.estatus === 'EN_PROCESO' ? 'var(--orange-light)' : 'var(--red-light)';
                const badgeColor = v.estatus === 'CUBIERTA' ? 'var(--green-dark)' : v.estatus === 'EN_PROCESO' ? '#7A4500' : 'var(--brand-red)';

                return (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--brand-navy-dark)', fontSize: '12px' }}>{v.puesto}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{v.departamento} • {v.cantidadCubierta}/{v.cantidadRequerida} plazas</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>
                        {v.estatus}
                      </span>
                      <button
                        onClick={() => v.id && deleteVacante(v.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand-navy)', padding: '2px' }}
                        title="Eliminar vacante"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
