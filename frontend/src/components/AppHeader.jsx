import { LayoutGrid, LogOut, ShieldCheck } from 'lucide-react'
import { routes } from '../lib/router'
import './AppHeader.css'

function initials(user) {
  const source = user?.fullName || user?.email || ''
  const parts = source.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase() || '?'
}

function AppHeader({ user, onLogout, onNavigate }) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => onNavigate(routes.catalog)}>
        <span className="brand-title">GearView3D</span>
      </button>

      <nav className="header-nav" aria-label="Main navigation">
        <button className="nav-link" onClick={() => onNavigate(routes.catalog)}>
          <LayoutGrid size={16} />
          Equipment Selection
        </button>
        {user?.role === 'ADMIN' && (
          <button className="nav-link" onClick={() => onNavigate(routes.admin)}>
            <ShieldCheck size={16} />
            Admin
          </button>
        )}
      </nav>

      <div className="header-account">
        <div className="account-chip">
          <span className="account-avatar">{initials(user)}</span>
          <span className="account-name">{user?.fullName || user?.email}</span>
        </div>
        <button className="logout-button" onClick={onLogout} aria-label="Logout" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

export default AppHeader
