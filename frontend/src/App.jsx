import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import LoginPage from './LoginPage'
import ModulesPage from './ModulesPage'
import TrainingSelectionPage from './TrainingSelectionPage'
import EquipmentUsagePage from './EquipmentUsagePage'
import WalkAroundCheckPage from './WalkAroundCheckPage'
import LoadHandlingPage from './LoadHandlingPage'
import PostOperationPage from './PostOperationPage'
import PartsIdentificationPage from './PartsIdentificationPage'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('modules') // 'modules', 'training-selection', 'equipment-usage', 'equipment-usage-module-1/2/3', 'parts-identification'
  const [selectedModule, setSelectedModule] = useState(null)
  const [selectedEquipmentModule, setSelectedEquipmentModule] = useState(null)

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

  const handleSelectEquipmentModule = (moduleId) => {
    setSelectedEquipmentModule(moduleId)
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
    setSelectedEquipmentModule(null)
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

  return <ModulesPage user={user} onLogout={handleLogout} onStartTraining={handleStartTraining} />
}

export default App
