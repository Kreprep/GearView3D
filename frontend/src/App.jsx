import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import LoginPage from './LoginPage'
import ModulesPage from './ModulesPage'
import TrainingSelectionPage from './TrainingSelectionPage'
import EquipmentUsagePage from './EquipmentUsagePage'
import PartsIdentificationPage from './PartsIdentificationPage'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('modules') // 'modules', 'training-selection', 'equipment-usage', 'parts-identification'
  const [selectedModule, setSelectedModule] = useState(null)

  const handleLogin = (credentials) => {
    setUser(credentials)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
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

  const handleBackToModules = () => {
    setCurrentPage('modules')
    setSelectedModule(null)
  }

  const handleBackToSelection = () => {
    setCurrentPage('training-selection')
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />
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
    />
  }

  if (currentPage === 'parts-identification') {
    return <PartsIdentificationPage 
      moduleName={selectedModule}
      onBack={handleBackToSelection}
    />
  }

  return <ModulesPage user={user} onLogout={handleLogout} onStartTraining={handleStartTraining} />
}

export default App
