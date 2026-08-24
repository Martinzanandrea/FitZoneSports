import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>FitZone Sports</span>
        </div>

        <button
          className="app-header__toggle"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
        >
          ☰
        </button>

        <nav className={`app-header__nav ${menuAbierto ? 'is-open' : ''}`}>
          <NavLink to="/" onClick={() => setMenuAbierto(false)}>Inicio</NavLink>
          <NavLink to="/clases" onClick={() => setMenuAbierto(false)}>Clases</NavLink>
          <NavLink to="/canchas" onClick={() => setMenuAbierto(false)}>Canchas</NavLink>
          <div className="app-header__user">
            <span>{user?.nombre} {user?.apellido}</span>
            <button onClick={logout}>Salir</button>
          </div>
        </nav>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}