import { useEffect, useMemo, useState } from 'react'
import CourseAdmin from './components/admin/CourseAdmin'
import PracticeQuizAdmin from './components/admin/PracticeQuizAdmin'
import WalkAroundHotspotAdmin from './components/admin/WalkAroundHotspotAdmin'
import {
  adminDeleteChecklistItem,
  adminDeleteModule,
  adminDeletePart,
  adminDeleteQuizQuestion,
  adminListContent,
  adminPublishPart,
  adminPublishPartDetail,
  adminRevertPart,
  adminRevertPartDetail,
  adminUpdateChecklistItem,
  adminUpdateEquipment,
  adminUpdateModule,
  adminUpdatePart,
  adminUpdatePartDetail,
  adminUpdateQuizQuestion,
} from './lib/api'
import { routes } from './lib/router'
import './AdminDashboard.css'

const adminTabs = [
  [routes.admin, 'Overview'],
  [routes.adminModules, 'Modules'],
  [routes.adminParts, 'Parts'],
  [routes.adminPractice, 'Practice Quiz'],
  [routes.adminCourses, 'Courses'],
  [routes.adminHotspots, 'Walk-Around Hotspots'],
  [routes.adminChecklists, 'Checklists'],
  [routes.adminQuizzes, 'Quizzes'],
  [routes.adminUsers, 'Users'],
  [routes.adminReports, 'Reports'],
]

// Parts, part details and practice questions store the published row in their
// columns and the admin's pending edit in `draft`. The dashboard always edits
// the draft when there is one, so reopening a row shows the work in progress
// rather than the older published values.
function editableRow(row) {
  if (!row) return row
  return row.draft ? { ...row, ...row.draft } : row
}

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

function AdminDashboard({ user, onBack, path, onNavigate }) {
  const [content, setContent] = useState({
    equipment: [],
    modules: [],
    parts: [],
    partDetails: {},
    checklists: [],
    quizQuestions: [],
    users: [],
    progress: [],
    activityLogs: [],
    localOnly: true,
  })
  const [selectedPart, setSelectedPart] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [editingModule, setEditingModule] = useState(null)
  const [editingEquipment, setEditingEquipment] = useState(null)
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
        partDetails: {},
        checklists: [],
        quizQuestions: [],
        users: [],
        progress: [],
        activityLogs: [],
        localOnly: true,
        ...data,
      })
      setEditingEquipment((current) => current || data.equipment?.[0] || null)
    })
  }, [])

  const refreshMessage = (message) => {
    setSaveMessage(message)
    window.setTimeout(() => setSaveMessage(''), 2400)
  }

  // Selecting a part also loads its detail-card entry (image + markdown
  // description) so both are edited and saved together.
  const selectPartForEditing = (part) => {
    setSelectedPart(editableRow(part))
    setSelectedDetail(
      editableRow(content.partDetails[part.id]) || {
        id: part.id,
        title: part.label,
        subtitle: part.category || '',
        image: '',
        description: '',
      },
    )
  }

  const selectDetailForEditing = (detail) => {
    setSelectedPart(null)
    setSelectedDetail(editableRow(detail))
  }

  // Publish and discard work off the selected ids rather than off the `draft`
  // in state: Publish saves first, and that save has not landed in state by the
  // time this runs. The API answers 400 when there is nothing pending, which is
  // the expected case for whichever of the two was not edited.
  const publishPartAndDetail = async () => {
    let published = false

    if (selectedPart) {
      const result = await adminPublishPart(selectedPart.id).catch(() => null)
      if (result) {
        replacePart(result.part)
        published = true
      }
    }
    if (selectedDetail) {
      const result = await adminPublishPartDetail(selectedDetail.id).catch(() => null)
      if (result) {
        replaceDetail(result.detail)
        published = true
      }
    }

    refreshMessage(published ? 'Published - learners see these changes now.' : 'Nothing to publish.')
  }

  const revertPartAndDetail = async () => {
    if (!window.confirm('Discard the unpublished changes and go back to the published version?')) return

    if (selectedPart) {
      const result = await adminRevertPart(selectedPart.id).catch(() => null)
      if (result) replacePart(result.part)
    }
    if (selectedDetail) {
      const result = await adminRevertPartDetail(selectedDetail.id).catch(() => null)
      if (result) replaceDetail(result.detail)
    }
    refreshMessage('Draft discarded.')
  }

  const replacePart = (part) => {
    setContent((current) => ({
      ...current,
      parts: current.parts.map((entry) => (entry.id === part.id ? part : entry)),
    }))
    setSelectedPart(editableRow(part))
  }

  const replaceDetail = (detail) => {
    setContent((current) => ({
      ...current,
      partDetails: { ...current.partDetails, [detail.id]: detail },
    }))
    setSelectedDetail(editableRow(detail))
  }

  const handleSaveDetail = async () => {
    if (!selectedDetail) return null
    const result = await adminUpdatePartDetail(selectedDetail.id, selectedDetail)
    replaceDetail(result.detail)
    return result.detail
  }

  const handleSavePart = async () => {
    if (selectedPart) {
      const result = await adminUpdatePart(selectedPart.id, selectedPart)
      replacePart(result.part)
    }
    await handleSaveDetail()
    refreshMessage('Draft saved. Publish to show it to learners.')
  }

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Delete this part from the admin content list?')) return
    await adminDeletePart(partId)
    setContent((current) => ({ ...current, parts: current.parts.filter((part) => part.id !== partId) }))
    setSelectedPart(null)
    setSelectedDetail(null)
  }

  const handleSaveEquipment = async () => {
    if (!editingEquipment) return
    const result = await adminUpdateEquipment(editingEquipment.id, editingEquipment)
    setContent((current) => ({
      ...current,
      equipment: current.equipment.map((item) => (item.id === editingEquipment.id ? result.equipment : item)),
    }))
    setEditingEquipment(result.equipment)
    refreshMessage('Equipment card changes saved.')
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
          <section className="admin-panel admin-editor">
            <h2>Equipment Card</h2>
            <p className="admin-panel-note">Controls the catalog cards on the home screen (image, title, description, availability).</p>
            <div className="admin-row-actions">
              {content.equipment.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={editingEquipment?.id === item.id ? 'admin-save' : ''}
                  onClick={() => setEditingEquipment(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            {editingEquipment ? (
              <>
                <label>Title<input value={editingEquipment.title} onChange={(event) => setEditingEquipment({ ...editingEquipment, title: event.target.value })} /></label>
                <label>Description<textarea value={editingEquipment.description} onChange={(event) => setEditingEquipment({ ...editingEquipment, description: event.target.value })} /></label>
                <label>Image URL<input value={editingEquipment.imageUrl || ''} onChange={(event) => setEditingEquipment({ ...editingEquipment, imageUrl: event.target.value })} /></label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={editingEquipment.available !== false}
                    onChange={(event) => setEditingEquipment({ ...editingEquipment, available: event.target.checked })}
                  />
                  Available for training
                </label>
                <p className="admin-panel-note">Unchecked renders the catalog card as a non-interactive &quot;Coming Soon&quot; placeholder.</p>
                <button className="admin-save" onClick={handleSaveEquipment}>Save equipment card</button>
              </>
            ) : <p>No equipment card available.</p>}
          </section>
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
                <label>Full title<input value={editingModule.fullTitle || ''} placeholder={editingModule.title} onChange={(event) => setEditingModule({ ...editingModule, fullTitle: event.target.value })} /></label>
                <p className="admin-panel-note">The long heading shown on the module page itself. Blank falls back to the title above.</p>
                <label>Image URL<input value={editingModule.imageUrl || ''} onChange={(event) => setEditingModule({ ...editingModule, imageUrl: event.target.value })} /></label>
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
              <button key={part.id} type="button" className={`admin-part-button ${selectedPart?.id === part.id ? 'is-active' : ''}`} onClick={() => selectPartForEditing(part)}>
                {part.label}
              </button>
            ))}
            <h2>Inspection Hotspots</h2>
            <p className="admin-panel-note">Walk-around checks that are not standalone parts. Each has the same detail card (image + markdown description).</p>
            {Object.values(content.partDetails)
              .filter((detail) => !content.parts.some((part) => part.id === detail.id))
              .map((detail) => (
                <button key={detail.id} type="button" className={`admin-part-button ${!selectedPart && selectedDetail?.id === detail.id ? 'is-active' : ''}`} onClick={() => selectDetailForEditing(detail)}>
                  {detail.title}
                </button>
              ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Part Editor</h2>
            {selectedPart && (
              <>
                <label>Part name<input value={selectedPart.label} onChange={(event) => setSelectedPart({ ...selectedPart, label: event.target.value })} /></label>
                <label>Category<input value={selectedPart.category || ''} onChange={(event) => setSelectedPart({ ...selectedPart, category: event.target.value })} /></label>
                <label>Function<textarea value={selectedPart.functionText} onChange={(event) => setSelectedPart({ ...selectedPart, functionText: event.target.value })} /></label>
                <label>Inspection reminder<textarea value={selectedPart.inspectionReminder || ''} onChange={(event) => setSelectedPart({ ...selectedPart, inspectionReminder: event.target.value })} /></label>
                <label>Safety note<textarea value={selectedPart.safetyNote} onChange={(event) => setSelectedPart({ ...selectedPart, safetyNote: event.target.value })} /></label>
                <label>Related module<input value={selectedPart.relatedModule || ''} onChange={(event) => setSelectedPart({ ...selectedPart, relatedModule: event.target.value })} /></label>
              </>
            )}
            {selectedDetail ? (
              <>
                <h2>Detail Card</h2>
                <p className="admin-panel-note">Shown when the part is clicked in the 3D viewers (Parts Identification and Walk-Around Check).</p>
                {!selectedPart && (
                  <label>Title<input value={selectedDetail.title || ''} onChange={(event) => setSelectedDetail({ ...selectedDetail, title: event.target.value })} /></label>
                )}
                <label>Subtitle<input value={selectedDetail.subtitle || ''} onChange={(event) => setSelectedDetail({ ...selectedDetail, subtitle: event.target.value })} /></label>
                <label>Reference image URL<input value={selectedDetail.image || ''} placeholder="/images/forks.png" onChange={(event) => setSelectedDetail({ ...selectedDetail, image: event.target.value })} /></label>
                <label>Description (Markdown)
                  <textarea rows={10} value={selectedDetail.description || ''} onChange={(event) => setSelectedDetail({ ...selectedDetail, description: event.target.value })} />
                </label>
                <p className="admin-panel-note">Supports markdown: **bold**, - bullet points, 1. numbered lists, and inline images anywhere via ![alt](/images/example.png).</p>
                {(selectedPart?.draft || selectedDetail?.draft) && (
                  <p className="admin-panel-note admin-draft-note">
                    Unpublished draft - learners still see the published version until you press Publish.
                  </p>
                )}
                <div className="admin-row-actions">
                  {selectedPart ? (
                    <>
                      <button onClick={handleSavePart}>Save draft</button>
                      <button className="admin-save" onClick={async () => { await handleSavePart(); await publishPartAndDetail() }}>Publish</button>
                      {(selectedPart.draft || selectedDetail?.draft) && (
                        <button onClick={revertPartAndDetail}>Discard draft</button>
                      )}
                      <button onClick={() => handleDeletePart(selectedPart.id)}>Delete part</button>
                    </>
                  ) : (
                    <>
                      <button onClick={async () => { await handleSaveDetail(); refreshMessage('Draft saved.') }}>Save draft</button>
                      <button className="admin-save" onClick={async () => { await handleSaveDetail(); await publishPartAndDetail() }}>Publish</button>
                      {selectedDetail.draft && <button onClick={revertPartAndDetail}>Discard draft</button>}
                    </>
                  )}
                </div>
              </>
            ) : <p>Select a forklift part or inspection hotspot to edit its detail card.</p>}
          </section>
        </main>
      )}

      {activePath === routes.adminPractice && (
        <main className="admin-grid">
          <PracticeQuizAdmin
            questions={content.practiceQuestions || []}
            categories={content.partCategories || []}
            onQuestionsChanged={(practiceQuestions) => setContent((current) => ({ ...current, practiceQuestions }))}
            onCategoriesChanged={(partCategories) => setContent((current) => ({ ...current, partCategories }))}
            onMessage={refreshMessage}
          />
        </main>
      )}

      {activePath === routes.adminCourses && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Driving Course Editor</h2>
            <p className="admin-panel-note">
              Place cones, walls, pallets, checkpoints and parking bays on a top-down map of each simulation step.
              Edits are saved as a draft; learners keep the published version until you press Publish.
            </p>
            <CourseAdmin onMessage={refreshMessage} />
          </section>
        </main>
      )}

      {activePath === routes.adminHotspots && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Walk-Around Hotspot Editor</h2>
            <p className="admin-panel-note">
              Click a point on the 3D model to place a hotspot, or drag an existing marker to reposition it.
              Edits are saved as a draft; learners keep the published position and text until you press Publish.
            </p>
            <WalkAroundHotspotAdmin onMessage={refreshMessage} />
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
