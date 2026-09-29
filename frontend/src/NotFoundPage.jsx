import AppHeader from './components/AppHeader'
import { usePageTitle } from './hooks/usePageTitle'
import { useT } from './i18n'
import { routes } from './lib/router'
import './NotFoundPage.css'

function NotFoundPage({ user, onLogout, onNavigate }) {
  const t = useT()
  usePageTitle(t('common.notFound.title'))
  return (
    <div className="not-found-page">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />
      <main className="not-found-card">
        <p className="not-found-code">404</p>
        <h1>{t('common.notFound.title')}</h1>
        <p>{t('common.notFound.body')}</p>
        <div className="not-found-actions">
          <button onClick={() => onNavigate(routes.home)}>{t('common.notFound.action')}</button>
        </div>
      </main>
    </div>
  )
}

export default NotFoundPage
