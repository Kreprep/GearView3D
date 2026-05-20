import './EquipmentUsagePage.css'

function EquipmentUsagePage({ moduleName, onBack, onSelectModule }) {
  const modules = [
    {
      id: 1,
      title: 'Walk-Around Check',
      subtitle: 'Visual Inspection',
      description: 'Perform comprehensive visual and operational inspections including fluid checks, component damage assessment, gauge monitoring, and safety device verification.',
    },
    {
      id: 2,
      title: 'Load Handling',
      subtitle: 'Operational Controls',
      description: 'Master maneuvering, load positioning, stability triangle concepts, hydraulic lever controls, and operational area safety protocols.',
    },
    {
      id: 3,
      title: 'Post-Operation',
      subtitle: 'Secure Parking',
      description: 'Execute safe parking procedures, engine cooldown protocols, and secure shutdown sequences following industry standards.',
    }
  ]

  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>{moduleName} - Equipment Usage Modules</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <p className="intro-text">Select a module to begin your forklift training:</p>
          
          <div className="modules-grid">
            {modules.map((module) => (
              <div key={module.id} className="module-card">
                <div className="module-image-placeholder">
                  <span className="placeholder-text">
                  {module.title} Image
                  </span>
                </div>
                <h3>{module.title}</h3>
                <h4>{module.subtitle}</h4>
                <p>{module.description}</p>
                <button 
                  className="start-module-button" 
                  onClick={() => onSelectModule(module.id)}
                >
                  Start Module {module.id}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default EquipmentUsagePage
