import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import TrainingHubPage from './TrainingHubPage'
import ModulesPage from './ModulesPage'
import WalkAroundCheckPage from './WalkAroundCheckPage'
import PartsIdentificationPage from './PartsIdentificationPage'
import GenericModulePage from './GenericModulePage'
import GenericAssessmentPage from './GenericAssessmentPage'
import HotspotIdentificationPage from './HotspotIdentificationPage'
import AdminDashboard from './AdminDashboard'
import NotFoundPage from './NotFoundPage'
import { getCurrentUser, loginUser, setAuthToken } from './lib/api'
import {
  hydrateChecklistCounts,
  hydratePartsCount,
  hydrateProgressFromServer,
  resetStoredProgress,
} from './lib/progressService'
import { goTo, normalizePath, routes } from './lib/router'
import './App.css'

function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('gearview_token')))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gearview_user')
    return saved ? JSON.parse(saved) : null
  })
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const syncPath = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  // The denominators progress percentages divide by are content, not user data,
  // so they are refreshed on every load rather than only on login - the
  // session-restore effect below is skipped whenever localStorage already holds
  // the user.
  useEffect(() => {
    hydratePartsCount().catch(() => {})
    hydrateChecklistCounts().catch(() => {})
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('gearview_token')

    if (!token || user) return

    setAuthToken(token)
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser)
        localStorage.setItem('gearview_user', JSON.stringify(currentUser))
        hydrateProgressFromServer().catch(() => {})
      })
      .catch(() => {
        localStorage.removeItem('gearview_token')
        localStorage.removeItem('gearview_user')
        setAuthToken(null)
        setIsLoggedIn(false)
        goTo(routes.login, { replace: true })
      })
  }, [user])

  useEffect(() => {
    if (!isLoggedIn && path !== routes.login) {
      goTo(routes.login, { replace: true })
    }

    if (isLoggedIn && (path === '/' || path === routes.login)) {
      goTo(routes.catalog, { replace: true })
    }

    // Forklift's training pages used to live under /training/forklift/equipment;
    // saved bookmarks and history entries for those paths land on the current
    // /training/forklift/modules/:slug scheme instead.
    if (isLoggedIn && path.startsWith('/training/forklift/equipment')) {
      const legacySlug = path.split('/')[4]
      const target = legacySlug === 'walk-around' ? routes.walkAround : legacySlug ? `/training/forklift/modules/${legacySlug}` : routes.forklift
      goTo(target, { replace: true })
    }
  }, [isLoggedIn, path])

  const navigate = (nextPath, options) => {
    goTo(nextPath, options)
  }

  const handleLogin = async (credentials) => {
    setLoginError('')
    const auth = await loginUser(credentials)
    localStorage.setItem('gearview_token', auth.token)
    localStorage.setItem('gearview_user', JSON.stringify(auth.user))
    setAuthToken(auth.token)
    setUser(auth.user)
    setIsLoggedIn(true)
    hydrateProgressFromServer().catch(() => {})
    navigate(routes.catalog, { replace: true })
  }

  const handleLogout = () => {
    localStorage.removeItem('gearview_token')
    localStorage.removeItem('gearview_user')
    setAuthToken(null)
    resetStoredProgress()
    setIsLoggedIn(false)
    setUser(null)
    navigate(routes.login, { replace: true })
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} loginError={loginError} setLoginError={setLoginError} />
  }

  // Blank frame while a redirect effect above is moving the path (login
  // bounce, or a legacy /training/forklift/equipment URL).
  if (path === '/' || path === routes.login || path.startsWith('/training/forklift/equipment')) {
    return null
  }

  if (path === routes.catalog) {
    return (
      <ModulesPage
        user={user}
        onLogout={handleLogout}
        onNavigate={navigate}
      />
    )
  }

  // Every equipment's training pages - Forklift included - are served from
  // this one data-driven branch. The only pages still keyed to Forklift are
  // Walk-Around Check (a hardcoded simulation with no Course-backed steps)
  // and the richer Parts Identification page; both are matched by slug here
  // rather than by a fixed route.
  if (path.startsWith('/training/') && !path.startsWith('/training/forklift/equipment')) {
    const [, , equipmentId, section, moduleSlug] = path.split('/')

    if (!equipmentId) {
      return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
    }

    if (section === 'modules' && moduleSlug) {
      if (equipmentId === 'forklift' && moduleSlug === 'walk-around-check') {
        return <WalkAroundCheckPage moduleName="Forklift" user={user} onBack={() => navigate(routes.forklift)} onNavigate={navigate} />
      }

      return (
        <GenericModulePage
          equipmentId={equipmentId}
          moduleSlug={moduleSlug}
          user={user}
          onBack={() => navigate(`/training/${equipmentId}`)}
          onNavigate={navigate}
        />
      )
    }

    if (section === 'parts') {
      if (equipmentId === 'forklift') {
        return (
          <PartsIdentificationPage
            moduleName="Forklift"
            user={user}
            onBack={() => navigate(routes.forklift)}
          />
        )
      }

      return (
        <HotspotIdentificationPage
          equipmentId={equipmentId}
          user={user}
          onBack={() => navigate(`/training/${equipmentId}`)}
        />
      )
    }

    if (section === 'assessment') {
      return (
        <GenericAssessmentPage
          equipmentId={equipmentId}
          user={user}
          onLogout={handleLogout}
          onBack={() => navigate(`/training/${equipmentId}`)}
          onNavigate={navigate}
        />
      )
    }

    return (
      <TrainingHubPage
        equipmentId={equipmentId}
        user={user}
        onLogout={handleLogout}
        onNavigate={navigate}
      />
    )
  }

  if (path === routes.admin || path.startsWith('/admin/')) {
    if (user?.role !== 'ADMIN') {
      return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
    }

    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        onBack={() => navigate(routes.catalog)}
        path={path}
        onNavigate={navigate}
      />
    )
  }

  return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
}

export default App
