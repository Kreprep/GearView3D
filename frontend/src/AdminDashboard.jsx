import { useEffect, useState } from 'react'
import { adminListContent, adminUpdatePart } from './lib/api'
import './AdminDashboard.css'

function AdminDashboard({ user, onLogout, onBack }) {
  const [content, setContent] = useState({ equipment: [], modules: [], parts: [], backendOnline: true })
  const [selectedPart, setSelectedPart] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    adminListContent().then(setContent)
  }, [])

  const handlePartChange = (field, value) => {
    setSelectedPart((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSavePart = async () => {
    if (!selectedPart) return

    await adminUpdatePart(selectedPart.id, selectedPart)
    setContent((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === selectedPart.id ? selectedPart : part)),
    }))
    setSaveMessage('Part changes saved.')
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">GearView3D Admin</p>
          <h1>Content Management</h1>
          <p>Signed in as {user?.email}</p>
        </div>
        <div className="admin-actions">
          <button onClick={onBack}>Back to App</button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>

      {!content.backendOnline && (
        <div className="admin-alert">
          Backend is not connected yet. This dashboard is showing local fallback content until the API is running.
        </div>
      )}

      <main className="admin-grid">
        <section className="admin-panel">
          <h2>Equipment</h2>
          {content.equipment.map((equipment) => (
            <article key={equipment.id} className="admin-list-item">
              <h3>{equipment.title}</h3>
              <p>{equipment.description}</p>
              <code>{equipment.modelUrl}</code>
            </article>
          ))}
        </section>

        <section className="admin-panel">
          <h2>Training Modules</h2>
          {content.modules.map((module) => (
            <article key={module.id} className="admin-list-item">
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </article>
          ))}
        </section>

        <section className="admin-panel admin-parts-list">
          <h2>Forklift Parts</h2>
          {content.parts.map((part) => (
            <button
              key={part.id}
              type="button"
              className={`admin-part-button ${selectedPart?.id === part.id ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedPart(part)
                setSaveMessage('')
              }}
            >
              {part.label}
            </button>
          ))}
        </section>

        <section className="admin-panel admin-editor">
          <h2>Part Editor</h2>
          {selectedPart ? (
            <>
              <label>
                Part name
                <input
                  value={selectedPart.label}
                  onChange={(event) => handlePartChange('label', event.target.value)}
                />
              </label>
              <label>
                Function
                <textarea
                  value={selectedPart.functionText}
                  onChange={(event) => handlePartChange('functionText', event.target.value)}
                />
              </label>
              <label>
                Safety reminder
                <textarea
                  value={selectedPart.safetyNote}
                  onChange={(event) => handlePartChange('safetyNote', event.target.value)}
                />
              </label>
              <button className="admin-save" onClick={handleSavePart}>Save part</button>
              {saveMessage && <p className="admin-save-message">{saveMessage}</p>}
            </>
          ) : (
            <p>Select a forklift part to review or edit its instructional text.</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
