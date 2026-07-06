import AppHeader from './AppHeader'
import './PageLayout.css'

function PageLayout({ user, onLogout, onNavigate, className = '', children }) {
  return (
    <div className="page-shell">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />
      <main className={`page-layout ${className}`.trim()}>{children}</main>
    </div>
  )
}

export default PageLayout
