import { useEffect, useMemo, useState } from 'react'
import {
  adminDeleteChecklistItem,
  adminDeleteModule,
  adminDeletePart,
  adminDeleteQuizQuestion,
  adminListContent,
  adminUpdateChecklistItem,
  adminUpdateModule,
  adminUpdatePart,
  adminUpdateQuizQuestion,
} from './lib/api'
import { routes } from './lib/router'
import './AdminDashboard.css'

const adminTabs = [
  [routes.admin, 'Overview'],
  [routes.adminModules, 'Modules'],
  [routes.adminParts, 'Parts'],
  [routes.adminChecklists, 'Checklists'],
  [routes.adminQuizzes, 'Quizzes'],
  [routes.adminUsers, 'Users'],
  [routes.adminReports, 'Reports'],
]

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function AdminDashboard({ user, onLogout, onBack, path, onNavigate }) {
  const [content, setContent] = useState({
    equipment: [],
    modules: [],
    parts: [],
    checklists: [],
    quizQuestions: [],
    users: [],
    progress: [],
    activityLogs: [],
    localOnly: true,
  })
  const [selectedPart, setSelectedPart] = useState(null)
  const [editingModule, setEditingModule] = useState(null)
  const [editingChecklist, setEditingChecklist] = useState(null)
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')

  const activePath = path || routes.admin
  const modulesById = useMemo(() => {
    return content.modules.reduce((map, module) => ({ ...map, [module.id]: module }), {})
  }, [content.modules])

  useEffect(() => {
    adminListContent().then((data) => {
      setContent({
        equipment: [],
        modules: [],
        parts: [],
        checklists: [],
        quizQuestions: [],
        users: [],
        progress: [],
        activityLogs: [],
        localOnly: true,
        ...data,
      })
    })
  }, [])

  const refreshMessage = (message) => {
    setSaveMessage(message)
    window.setTimeout(() => setSaveMessage(''), 2400)
  }

  const handleSavePart = async () => {
    if (!selectedPart) return
    const result = await adminUpdatePart(selectedPart.id, selectedPart)
    setContent((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === selectedPart.id ? result.part : part)),
    }))
    setSelectedPart(result.part)
    refreshMessage('Part changes saved.')
  }

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Delete this part from the admin content list?')) return
    await adminDeletePart(partId)
    setContent((current) => ({ ...current, parts: current.parts.filter((part) => part.id !== partId) }))
    setSelectedPart(null)
  }

  const handleSaveModule = async () => {
    if (!editingModule) return
    const result = await adminUpdateModule(editingModule.id, editingModule)
    setContent((current) => ({
      ...current,
      modules: current.modules.map((module) => (module.id === editingModule.id ? result.module : module)),
    }))
    refreshMessage('Module changes saved.')
  }

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Delete this module? This can remove related lesson content.')) return
    await adminDeleteModule(moduleId)
    setContent((current) => ({ ...current, modules: current.modules.filter((module) => module.id !== moduleId) }))
  }

  const handleSaveChecklist = async () => {
    if (!editingChecklist) return
    const result = await adminUpdateChecklistItem(editingChecklist.id, editingChecklist)
    setContent((current) => ({
      ...current,
      checklists: current.checklists.map((item) => (item.id === editingChecklist.id ? { ...item, ...result.item } : item)),
    }))
    refreshMessage('Checklist item saved.')
  }

  const handleDeleteChecklist = async (itemId) => {
    if (!window.confirm('Delete this checklist item?')) return
    await adminDeleteChecklistItem(itemId)
    setContent((current) => ({ ...current, checklists: current.checklists.filter((item) => item.id !== itemId) }))
  }

  const handleSaveQuiz = async () => {
    if (!editingQuiz) return
    const result = await adminUpdateQuizQuestion(editingQuiz.id, {
      ...editingQuiz,
      options: editingQuiz.options.map((option) => option.text || option),
    })
    setContent((current) => ({
      ...current,
      quizQuestions: current.quizQuestions.map((question) => (question.id === editingQuiz.id ? result.question : question)),
    }))
    refreshMessage('Quiz question saved.')
  }

  const handleDeleteQuiz = async (questionId) => {
    if (!window.confirm('Delete this quiz question?')) return
    await adminDeleteQuizQuestion(questionId)
    setContent((current) => ({ ...current, quizQuestions: current.quizQuestions.filter((question) => question.id !== questionId) }))
  }

  const exportReports = () => {
    downloadCsv('gearview3d-progress-report.csv', [
      ['Learner', 'Module', 'Progress', 'Updated At'],
      ...content.progress.map((item) => [item.user?.email, item.moduleSlug, item.progress, item.updatedAt]),
    ])
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

      <nav className="admin-tabs" aria-label="Admin sections">
        {adminTabs.map(([tabPath, label]) => (
          <button
            key={tabPath}
            className={activePath === tabPath ? 'active' : ''}
            onClick={() => onNavigate(tabPath)}
          >
            {label}
          </button>
        ))}
      </nav>

      {content.localOnly && (
        <div className="admin-alert">
          Frontend-only prototype mode is active. Admin changes are saved in this browser's localStorage.
        </div>
      )}

      {saveMessage && <div className="admin-save-message">{saveMessage}</div>}

      {activePath === routes.admin && (
        <main className="admin-grid">
          {[
            ['Modules', content.modules.length],
            ['Parts', content.parts.length],
            ['Checklist Items', content.checklists.length],
            ['Quiz Questions', content.quizQuestions.length],
          ].map(([label, value]) => (
            <section key={label} className="admin-panel stat-panel">
              <p>{label}</p>
              <strong>{value}</strong>
            </section>
          ))}
        </main>
      )}

      {activePath === routes.adminModules && (
        <main className="admin-grid">
          <section className="admin-panel">
            <h2>Training Modules</h2>
            {content.modules.map((module) => (
              <article key={module.id} className="admin-list-item">
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <div className="admin-row-actions">
                  <button onClick={() => setEditingModule(module)}>Edit</button>
                  <button onClick={() => handleDeleteModule(module.id)}>Delete</button>
                </div>
              </article>
            ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Module Editor</h2>
            {editingModule ? (
              <>
                <label>Title<input value={editingModule.title} onChange={(event) => setEditingModule({ ...editingModule, title: event.target.value })} /></label>
                <label>Subtitle<input value={editingModule.subtitle} onChange={(event) => setEditingModule({ ...editingModule, subtitle: event.target.value })} /></label>
                <label>Description<textarea value={editingModule.description} onChange={(event) => setEditingModule({ ...editingModule, description: event.target.value })} /></label>
                <button className="admin-save" onClick={handleSaveModule}>Save module</button>
              </>
            ) : <p>Select a module to edit.</p>}
          </section>
        </main>
      )}

      {activePath === routes.adminParts && (
        <main className="admin-grid">
          <section className="admin-panel admin-parts-list">
            <h2>Forklift Parts</h2>
            {content.parts.map((part) => (
              <button key={part.id} type="button" className={`admin-part-button ${selectedPart?.id === part.id ? 'is-active' : ''}`} onClick={() => setSelectedPart(part)}>
                {part.label}
              </button>
            ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Part Editor</h2>
            {selectedPart ? (
              <>
                <label>Part name<input value={selectedPart.label} onChange={(event) => setSelectedPart({ ...selectedPart, label: event.target.value })} /></label>
                <label>Category<input value={selectedPart.category || ''} onChange={(event) => setSelectedPart({ ...selectedPart, category: event.target.value })} /></label>
                <label>Function<textarea value={selectedPart.functionText} onChange={(event) => setSelectedPart({ ...selectedPart, functionText: event.target.value })} /></label>
                <label>Inspection reminder<textarea value={selectedPart.inspectionReminder || ''} onChange={(event) => setSelectedPart({ ...selectedPart, inspectionReminder: event.target.value })} /></label>
                <label>Safety note<textarea value={selectedPart.safetyNote} onChange={(event) => setSelectedPart({ ...selectedPart, safetyNote: event.target.value })} /></label>
                <label>Related module<input value={selectedPart.relatedModule || ''} onChange={(event) => setSelectedPart({ ...selectedPart, relatedModule: event.target.value })} /></label>
                <div className="admin-row-actions">
                  <button className="admin-save" onClick={handleSavePart}>Save part</button>
                  <button onClick={() => handleDeletePart(selectedPart.id)}>Delete part</button>
                </div>
              </>
            ) : <p>Select a forklift part to review or edit its instructional text.</p>}
          </section>
        </main>
      )}

      {activePath === routes.adminChecklists && (
        <main className="admin-grid">
          <section className="admin-panel">
            <h2>Checklist Items</h2>
            {content.checklists.map((item) => (
              <article key={item.id} className="admin-list-item">
                <h3>{modulesById[item.moduleId]?.title || item.module?.title || `Module ${item.moduleId}`}</h3>
                <p>{item.text}</p>
                <div className="admin-row-actions">
                  <button onClick={() => setEditingChecklist(item)}>Edit</button>
                  <button onClick={() => handleDeleteChecklist(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Checklist Editor</h2>
            {editingChecklist ? (
              <>
                <label>Checklist text<textarea value={editingChecklist.text} onChange={(event) => setEditingChecklist({ ...editingChecklist, text: event.target.value })} /></label>
                <button className="admin-save" onClick={handleSaveChecklist}>Save checklist item</button>
              </>
            ) : <p>Select a checklist item to edit.</p>}
          </section>
        </main>
      )}

      {activePath === routes.adminQuizzes && (
        <main className="admin-grid">
          <section className="admin-panel">
            <h2>Quiz Questions</h2>
            {content.quizQuestions.map((question) => (
              <article key={question.id} className="admin-list-item">
                <h3>{modulesById[question.moduleId]?.title || question.module?.title}</h3>
                <p>{question.prompt}</p>
                <div className="admin-row-actions">
                  <button onClick={() => setEditingQuiz(question)}>Edit</button>
                  <button onClick={() => handleDeleteQuiz(question.id)}>Delete</button>
                </div>
              </article>
            ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Quiz Editor</h2>
            {editingQuiz ? (
              <>
                <label>Prompt<textarea value={editingQuiz.prompt} onChange={(event) => setEditingQuiz({ ...editingQuiz, prompt: event.target.value })} /></label>
                <label>Correct answer<input value={editingQuiz.answer} onChange={(event) => setEditingQuiz({ ...editingQuiz, answer: event.target.value })} /></label>
                <label>Choices<textarea value={editingQuiz.options.map((option) => option.text || option).join('\n')} onChange={(event) => setEditingQuiz({ ...editingQuiz, options: event.target.value.split('\n').filter(Boolean) })} /></label>
                <button className="admin-save" onClick={handleSaveQuiz}>Save quiz question</button>
              </>
            ) : <p>Select a quiz question to edit.</p>}
          </section>
        </main>
      )}

      {activePath === routes.adminUsers && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Learner Users</h2>
            {content.users.map((learner) => (
              <article key={learner.id} className="admin-list-item">
                <h3>{learner.fullName}</h3>
                <p>{learner.email} - {learner.role}</p>
              </article>
            ))}
          </section>
        </main>
      )}

      {activePath === routes.adminReports && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <div className="admin-panel-heading">
              <h2>Progress Reports</h2>
              <button className="admin-save" onClick={exportReports}>Export CSV</button>
            </div>
            {content.progress.length ? content.progress.map((item) => (
              <article key={item.id} className="admin-list-item">
                <h3>{item.user?.fullName || item.user?.email}</h3>
                <p>{item.moduleSlug}: {item.progress}% complete</p>
              </article>
            )) : <p>No saved local progress yet.</p>}
          </section>
        </main>
      )}
    </div>
  )
}

export default AdminDashboard
