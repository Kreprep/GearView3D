import AppHeader from './components/AppHeader'
import { routes } from './lib/router'
import './NotFoundPage.css'

function NotFoundPage({ user, onLogout, onNavigate }) {
  return (
    <div className="not-found-page">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />
      <main className="not-found-card">
        <p className="not-found-code">404</p>
        <h1>Page not found</h1>
        <p>The page you opened is not part of the current GearView3D training flow.</p>
        <div className="not-found-actions">
          <button onClick={() => onNavigate(routes.dashboard)}>Go to dashboard</button>
          <button onClick={() => onNavigate(routes.catalog)}>Browse catalog</button>
        </div>
      </main>
    </div>
  )
}

export default NotFoundPage
