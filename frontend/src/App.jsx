import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import ModulesPage from './ModulesPage'
import TrainingSelectionPage from './TrainingSelectionPage'
import EquipmentUsagePage from './EquipmentUsagePage'
import WalkAroundCheckPage from './WalkAroundCheckPage'
import LoadHandlingPage from './LoadHandlingPage'
import PostOperationPage from './PostOperationPage'
import PartsIdentificationPage from './PartsIdentificationPage'
import AdminDashboard from './AdminDashboard'
import { getCurrentUser, loginUser, setAuthToken } from './lib/api'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('gearview_token')))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gearview_user')
    return saved ? JSON.parse(saved) : null
  })
  const [currentPage, setCurrentPage] = useState('modules') // 'modules', 'training-selection', 'equipment-usage', 'equipment-usage-module-1/2/3', 'parts-identification'
  const [selectedModule, setSelectedModule] = useState(null)
  const [loginError, setLoginError] = useState('')

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
        setIsLoggedIn(false)
      })
  }, [user])

  const handleLogin = async (credentials) => {
    setLoginError('')
    const auth = await loginUser(credentials)
    localStorage.setItem('gearview_token', auth.token)
    localStorage.setItem('gearview_user', JSON.stringify(auth.user))
    setAuthToken(auth.token)
    setUser(auth.user)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('gearview_token')
    localStorage.removeItem('gearview_user')
    setAuthToken(null)
    setIsLoggedIn(false)
    setUser(null)
    setCurrentPage('modules')
  }

  const handleStartTraining = (moduleName) => {
    setSelectedModule(moduleName)
    setCurrentPage('training-selection')
  }

  const handleSelectTraining = (trainingType) => {
    if (trainingType === 'equipment-usage') {
      setCurrentPage('equipment-usage')
    } else if (trainingType === 'parts-identification') {
      setCurrentPage('parts-identification')
    }
  }

  const handleSelectEquipmentModule = (moduleId) => {
    if (moduleId === 1) {
      setCurrentPage('equipment-usage-module-1')
    } else if (moduleId === 2) {
      setCurrentPage('equipment-usage-module-2')
    } else if (moduleId === 3) {
      setCurrentPage('equipment-usage-module-3')
    }
  }

  const handleBackToEquipmentUsage = () => {
    setCurrentPage('equipment-usage')
  }

  const handleBackToModules = () => {
    setCurrentPage('modules')
    setSelectedModule(null)
  }

  const handleBackToSelection = () => {
    setCurrentPage('training-selection')
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} loginError={loginError} setLoginError={setLoginError} />
  }

  if (currentPage === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} onBack={handleBackToModules} />
  }

  if (currentPage === 'training-selection') {
    return <TrainingSelectionPage 
      moduleName={selectedModule} 
      onSelectTraining={handleSelectTraining}
      onBack={handleBackToModules}
    />
  }

  if (currentPage === 'equipment-usage') {
    return <EquipmentUsagePage 
      moduleName={selectedModule}
      onBack={handleBackToSelection}
      onSelectModule={handleSelectEquipmentModule}
    />
  }

  if (currentPage === 'equipment-usage-module-1') {
    return <WalkAroundCheckPage 
      moduleName={selectedModule}
      onBack={handleBackToEquipmentUsage}
    />
  }

  if (currentPage === 'equipment-usage-module-2') {
    return <LoadHandlingPage 
      moduleName={selectedModule}
      onBack={handleBackToEquipmentUsage}
    />
  }

  if (currentPage === 'equipment-usage-module-3') {
    return <PostOperationPage 
      moduleName={selectedModule}
      onBack={handleBackToEquipmentUsage}
    />
  }

  if (currentPage === 'parts-identification') {
    return <PartsIdentificationPage 
      moduleName={selectedModule}
      onBack={handleBackToSelection}
    />
  }

  return (
    <ModulesPage
      user={user}
      onLogout={handleLogout}
      onStartTraining={handleStartTraining}
      onOpenAdmin={() => setCurrentPage('admin')}
    />
  )
}

export default App
