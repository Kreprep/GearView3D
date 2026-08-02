import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import ForkliftTrainingPage from './ForkliftTrainingPage'
import ModulesPage from './ModulesPage'
import EquipmentUsagePage from './EquipmentUsagePage'
import WalkAroundCheckPage from './WalkAroundCheckPage'
import LoadHandlingPage from './LoadHandlingPage'
import PostOperationPage from './PostOperationPage'
import PalletTestingPage from './PalletTestingPage'
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
      goTo(routes.catalog, { replace: true })
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
    navigate(routes.catalog, { replace: true })
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

  if (path === routes.forklift) {
    return <ForkliftTrainingPage moduleName="Forklift" user={user} onLogout={handleLogout} onNavigate={navigate} />
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

  if (path === routes.equipment) {
    return (
      <EquipmentUsagePage
        moduleName="Forklift"
        user={user}
        onLogout={handleLogout}
        onBack={() => navigate(routes.forklift)}
        onNavigate={navigate}
      />
    )
  }

  if (path === routes.walkAround) {
    return <WalkAroundCheckPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} onNavigate={navigate} />
  }

  if (path === routes.loadHandling) {
    return <LoadHandlingPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} onNavigate={navigate} />
  }

  if (path === routes.postOperation) {
    return <PostOperationPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} onNavigate={navigate} />
  }

  if (path === routes.palletTesting) {
    return <PalletTestingPage moduleName="Forklift" onBack={() => navigate(routes.equipment)} onNavigate={navigate} />
  }

  if (path === routes.parts) {
    return (
      <PartsIdentificationPage
        moduleName="Forklift"
        user={user}
        onLogout={handleLogout}
        onBack={() => navigate(routes.forklift)}
        onNavigate={navigate}
      />
    )
  }

  if (path === routes.assessment) {
    return (
      <AssessmentPage
        moduleName="Forklift"
        user={user}
        onLogout={handleLogout}
        onBack={() => navigate(routes.forklift)}
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
