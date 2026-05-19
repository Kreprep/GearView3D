import './ModulesPage.css'

function ModulesPage({ user, onLogout }) {
  const modules = [
    {
      id: 1,
      title: 'Forklift',
      description: 'Learn to operate and maintain forklifts safely'
    },
    {
      id: 2,
      title: 'Bulldozer',
      description: 'Master bulldozer operation and techniques'
    },
    {
      id: 3,
      title: 'Industrial Crane',
      description: 'Understand crane safety and operation procedures'
    }
  ]

  return (
    <div className="modules-container">
      <header className="modules-header">
        <h1>GearView3D Training Modules</h1>
        <div className="header-right">
          <span className="user-info">Welcome, {user?.email}</span>
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="modules-grid">
        {modules.map((module) => (
          <div key={module.id} className="module-card">
            <div className="module-image-placeholder">
              <span className="placeholder-text">
                {module.title} Image
              </span>
            </div>
            <div className="module-content">
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              <button className="start-button">Start Training</button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default ModulesPage
