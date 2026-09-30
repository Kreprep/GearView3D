import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import TrainingHubPage from './TrainingHubPage'
import PartsIdentificationPage from './PartsIdentificationPage'
import GenericModulePage from './GenericModulePage'
import ModuleListPage from './ModuleListPage'
import GenericAssessmentPage from './GenericAssessmentPage'
import AdminDashboard from './AdminDashboard'
import NotFoundPage from './NotFoundPage'
import { getCurrentUser, loginUser, signupUser, setAuthToken, subscribeToSessionExpiry } from './lib/api'
import {
  hydrateChecklistCounts,
  hydrateProgressFromServer,
  resetStoredProgress,
} from './lib/progressService'
import { goTo, legacyRedirect, normalizePath, routes } from './lib/router'
import { canOpenDashboard } from './data/permissions.js'
import { useMediaQuery } from './hooks/useMediaQuery'
import DesktopOnlyNotice, { DESKTOP_MEDIA_QUERY } from './components/DesktopOnlyNotice'
import './App.css'

// What signing out clears outside React state, whether the learner chose to or
// the server refused their token. The server copy of their progress is
// untouched and comes back on the next sign-in.
function clearStoredSession() {
  localStorage.removeItem('gearview_token')
  localStorage.removeItem('gearview_user')
  setAuthToken(null)
  resetStoredProgress()
}

function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('gearview_token')))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gearview_user')
    return saved ? JSON.parse(saved) : null
  })
  const [loginError, setLoginError] = useState('')
  // Set when the server ended the session rather than the learner, so the
  // sign-in page can say why they are looking at it.
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const syncPath = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  // Any request the server refuses with 401 lands here, from whichever page
  // made it. The checklist-counts fetch below runs on every load, so a dead
  // token is caught whatever page opens first.
  useEffect(() => subscribeToSessionExpiry(() => {
    clearStoredSession()
    setUser(null)
    setIsLoggedIn(false)
    setSessionExpired(true)
    goTo(routes.login, { replace: true })
  }), [])

  // The denominators progress percentages divide by are content, not user data,
  // so they are refreshed on every load rather than only on login - the
  // session-restore effect below is skipped whenever localStorage already holds
  // the user.
  useEffect(() => {
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
      goTo(routes.home, { replace: true })
    }

    // Bookmarks and history entries from before the app was narrowed to the
    // forklift land on the page that replaced them.
    const legacyTarget = isLoggedIn ? legacyRedirect(path) : null
    if (legacyTarget) goTo(legacyTarget, { replace: true })
  }, [isLoggedIn, path])

  const navigate = (nextPath, options) => {
    goTo(nextPath, options)
  }

  const completeAuth = (auth) => {
    localStorage.setItem('gearview_token', auth.token)
    localStorage.setItem('gearview_user', JSON.stringify(auth.user))
    setAuthToken(auth.token)
    setUser(auth.user)
    setIsLoggedIn(true)
    setSessionExpired(false)
    hydrateProgressFromServer().catch(() => {})
    navigate(routes.home, { replace: true })
  }

  const handleLogin = async (credentials) => {
    setLoginError('')
    completeAuth(await loginUser(credentials))
  }

  const handleSignup = async (credentials) => {
    setLoginError('')
    completeAuth(await signupUser(credentials))
  }

  const handleLogout = () => {
    clearStoredSession()
    setIsLoggedIn(false)
    setUser(null)
    setSessionExpired(false)
    navigate(routes.login, { replace: true })
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onSignup={handleSignup}
        loginError={loginError}
        setLoginError={setLoginError}
        sessionExpired={sessionExpired}
      />
    )
  }

  // Blank frame while a redirect effect above is moving the path (login
  // bounce, or a legacy URL).
  if (path === '/' || path === routes.login || legacyRedirect(path)) {
    return null
  }

  // The training pages: /training[/section[/slug]]. Anything deeper, or an
  // unknown section, is a 404 rather than silently showing the hub.
  if (path === routes.home || path.startsWith(`${routes.home}/`)) {
    const [section, moduleSlug, ...rest] = path.slice(routes.home.length + 1).split('/')

    if (!section) {
      return <TrainingHubPage user={user} onLogout={handleLogout} onNavigate={navigate} />
    }

    if (section === 'modules' && !rest.length) {
      if (!moduleSlug) {
        return (
          <ModuleListPage
            user={user}
            onLogout={handleLogout}
            onBack={() => navigate(routes.home)}
            onNavigate={navigate}
          />
        )
      }

      return (
        // Keyed so moving between modules (a summary step's nextRoute, for
        // one) remounts the page instead of reusing the previous module's
        // step index and simulation state.
        <GenericModulePage
          key={moduleSlug}
          moduleSlug={moduleSlug}
          user={user}
          onBack={() => navigate(routes.modules)}
          onNavigate={navigate}
        />
      )
    }

    if (section === 'parts' && !moduleSlug) {
      return <PartsIdentificationPage user={user} onBack={() => navigate(routes.home)} />
    }

    if (section === 'assessment' && !moduleSlug) {
      return (
        <GenericAssessmentPage
          user={user}
          onLogout={handleLogout}
          onBack={() => navigate(routes.home)}
          onNavigate={navigate}
        />
      )
    }

    return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
  }

  if (path === routes.admin || path.startsWith('/admin/')) {
    // Whoever holds a permission with a screen there: admins and instructors.
    // What each sees inside is AdminDashboard's business, and the API's.
    if (!canOpenDashboard(user)) {
      return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
    }

    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        onBack={() => navigate(routes.home)}
        path={path}
        onNavigate={navigate}
      />
    )
  }

  return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
}

// The viewport gate sits outside App rather than inside it, so a phone or a
// portrait tablet never mounts App at all - no session restore, no progress
// hydration, no content fetches for a screen that cannot run the training.
// Crossing the breakpoint remounts App, which is the right behaviour: the page
// is being entered fresh at a size it was designed for.
function AppRoot() {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)

  if (!isDesktop) return <DesktopOnlyNotice />
  return <App />
}

export default AppRoot
