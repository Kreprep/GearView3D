import { ClipboardList, GraduationCap, LogOut, ShieldCheck } from 'lucide-react'
import { routes } from '../lib/router'
import { canOpenDashboard, normalizeRole } from '../data/permissions.js'
import { useT } from '../i18n'
import LanguageToggle from './LanguageToggle'
import './AppHeader.css'

function initials(user) {
  const source = user?.fullName || user?.email || ''
  const parts = source.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase() || '?'
}

function AppHeader({ user, onLogout, onNavigate }) {
  const t = useT()

  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => onNavigate(routes.home)}>
        <span className="brand-title">GearView3D</span>
      </button>

      <nav className="header-nav" aria-label={t('header.mainNavigation')}>
        <button className="nav-link" onClick={() => onNavigate(routes.home)}>
          <GraduationCap size={16} />
          {t('header.nav.home')}
        </button>
        <a
          className="nav-link"
          href="https://forms.gle/HhadFBkLaruZ7quK6"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ClipboardList size={16} />
          {t('header.nav.survey')}
        </a>
        {canOpenDashboard(user) && (
          <button className="nav-link" onClick={() => onNavigate(routes.admin)}>
            <ShieldCheck size={16} />
            {t('header.nav.dashboard')}
          </button>
        )}
      </nav>

      <div className="header-account">
        <LanguageToggle />
        <div className="account-chip">
          <span className="account-avatar">{initials(user)}</span>
          <span className="account-text">
            <span className="account-name">{user?.fullName || user?.email}</span>
            <span className="account-role">{t(`header.role.${normalizeRole(user?.role)}`)}</span>
          </span>
        </div>
        <button className="logout-button" onClick={onLogout} aria-label={t('header.logout')} title={t('header.logout')}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

export default AppHeader
