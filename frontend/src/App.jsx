import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import DashboardPage from './DashboardPage'
import ModulesPage from './ModulesPage'
import TrainingSelectionPage from './TrainingSelectionPage'
import EquipmentUsagePage from './EquipmentUsagePage'
import WalkAroundCheckPage from './WalkAroundCheckPage'
import LoadHandlingPage from './LoadHandlingPage'
import PostOperationPage from './PostOperationPage'
import PartsIdentificationPage from './PartsIdentificationPage'
import AssessmentPage from './AssessmentPage'
import AdminDashboard from './AdminDashboard'
import NotFoundPage from './NotFoundPage'
import { getCurrentUser, loginUser, setAuthToken } from './lib/api'
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

  useEffect(() => {
    const token = localStorage.getItem('gearview_token')

    if (!token || user) return

    setAuthToken(token)
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser)
        localStorage.setItem('gearview_user', JSON.stringify(currentUser))
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
      goTo(routes.dashboard, { replace: true })
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
    navigate(routes.dashboard, { replace: true })
  }

  const handleLogout = () => {
    localStorage.removeItem('gearview_token')
    localStorage.removeItem('gearview_user')
    setAuthToken(null)
    setIsLoggedIn(false)
    setUser(null)
    navigate(routes.login, { replace: true })
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} loginError={loginError} setLoginError={setLoginError} />
  }

  if (path === '/' || path === routes.login) {
    return null
  }

  if (path === routes.dashboard) {
    return <DashboardPage user={user} onLogout={handleLogout} onNavigate={navigate} />
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

  if (path === routes.forklift) {
    return (
      <TrainingSelectionPage
        moduleName="Forklift"
        onNavigate={navigate}
        onBack={() => navigate(routes.catalog)}
      />
    )
  }

  if (path === routes.equipment) {
    return (
      <EquipmentUsagePage
        moduleName="Forklift"
        onBack={() => navigate(routes.forklift)}
        onNavigate={navigate}
      />
    )
  }

  if (path === routes.walkAround) {
    return <WalkAroundCheckPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} />
  }

  if (path === routes.loadHandling) {
    return <LoadHandlingPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} />
  }

  if (path === routes.postOperation) {
    return <PostOperationPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} />
  }

  if (path === routes.parts) {
    return <PartsIdentificationPage moduleName="Forklift" onBack={() => navigate(routes.forklift)} />
  }

  if (path === routes.assessment) {
    return (
      <AssessmentPage
        moduleName="Forklift"
        onBack={() => navigate(routes.forklift)}
        onNavigate={navigate}
      />
    )
  }

  if (path === routes.admin) {
    return <AdminDashboard user={user} onLogout={handleLogout} onBack={() => navigate(routes.dashboard)} />
  }

  return <NotFoundPage user={user} onLogout={handleLogout} onNavigate={navigate} />
}

export default App
