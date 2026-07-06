import { routes } from '../lib/router'
import './AppHeader.css'

function AppHeader({ user, onLogout, onNavigate, title = 'GearView3D', subtitle = 'Forklift training workspace' }) {
  return (
    <header className="modules-header">
      <button className="brand-block brand-button" onClick={() => onNavigate(routes.dashboard)}>
        <span className="brand-mark">GV</span>
        <span>
          <span className="brand-title">{title}</span>
          <span className="brand-subtitle">{subtitle}</span>
        </span>
      </button>

      <nav className="header-right" aria-label="Main navigation">
        <button className="nav-button" onClick={() => onNavigate(routes.dashboard)}>
          Dashboard
        </button>
        <button className="nav-button" onClick={() => onNavigate(routes.catalog)}>
          Catalog
        </button>
        {user?.role === 'ADMIN' && (
          <button className="nav-button" onClick={() => onNavigate(routes.admin)}>
            Admin
          </button>
        )}
        <span className="user-info">Welcome, {user?.fullName || user?.email}</span>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </nav>
    </header>
  )
}

export default AppHeader
