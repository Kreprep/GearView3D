import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Layers,
  LayoutGrid,
  TrendingUp,
  Truck,
  Users as UsersIcon,
  Wrench,
} from 'lucide-react'
import InteractiveForkliftViewer from './components/InteractiveForkliftViewer'
import EquipmentHotspotAdmin from './components/admin/EquipmentHotspotAdmin'
import HubContentEditor from './components/admin/HubContentEditor'
import ModuleEditor from './components/admin/ModuleEditor'
import ModuleListAdmin from './components/admin/ModuleListAdmin'
import QuizAdmin from './components/admin/QuizAdmin'
import VehicleProfileEditor from './components/admin/VehicleProfileEditor'
import WalkAroundHotspotAdmin from './components/admin/WalkAroundHotspotAdmin'
import {
  adminCreateEquipment,
  adminCreatePartCategory,
  adminCreateUser,
  adminDeleteEquipment,
  adminDeletePartCategory,
  adminDeletePart,
  adminDeleteUser,
  adminListContent,
  adminPublishPart,
  adminPublishPartDetail,
  adminRevertPart,
  adminRevertPartDetail,
  adminUpdateEquipment,
  adminUpdatePartCategory,
  adminUpdatePart,
  adminUpdatePartDetail,
  adminUpdateUser,
} from './lib/api'
import { adminModuleRoute, routes } from './lib/router'
import './AdminDashboard.css'

// The three sections every equipment has under Training Content. Paths stay
// equipment-agnostic; which equipment's data fills them is tracked by
// `activeEquipmentId` state instead. Steps, checklist items and quiz
// questions have no section of their own - they live inside a module.
const equipmentContentTabs = [
  [routes.adminModules, 'Modules', Layers],
  [routes.adminParts, 'Parts Identification', Wrench],
  [routes.adminSettings, 'Equipment Settings', Wrench],
]

const trailingTabs = [
  [routes.adminUsers, 'Users', UsersIcon],
  [routes.adminReports, 'Reports', BarChart3],
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

const DAY_MS = 24 * 60 * 60 * 1000

function formatRelativeTime(dateString) {
  const elapsed = Date.now() - new Date(dateString).getTime()
  if (elapsed < 60 * 1000) return 'just now'
  if (elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 1000))}m ago`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / (60 * 60 * 1000))}h ago`
  return `${Math.floor(elapsed / DAY_MS)}d ago`
}

function describeActivity(entry, moduleTitle) {
  const who = entry.user?.fullName || entry.user?.email || 'A learner'
  if (entry.action === 'quiz_attempt') return `${who} completed a quiz in ${moduleTitle || entry.detail}`
  if (entry.action === 'parts_practice_attempt') return `${who} scored ${entry.detail} on the parts quiz`
  return `${who} - ${entry.action}`
}

function AdminDashboard({ user, onBack, path, onNavigate }) {
  const [content, setContent] = useState({
    equipment: [],
    modules: [],
    parts: [],
    partDetails: {},
    partCategories: [],
    checklists: [],
    quizQuestions: [],
    users: [],
    progress: [],
    activityLogs: [],
    localOnly: true,
  })
  const [selectedPart, setSelectedPart] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [editingEquipment, setEditingEquipment] = useState(null)
  // Which equipment's section is expanded in the nav - the seven sub-tab
  // paths are shared by every equipment, so this (not the URL) decides whose
  // modules/parts/courses/etc. the tab bodies below show.
  const [activeEquipmentId, setActiveEquipmentId] = useState('forklift')
  const [editingUser, setEditingUser] = useState(null)
  const [newCategory, setNewCategory] = useState('')
  const [newEquipmentTitle, setNewEquipmentTitle] = useState('')
  // Placement mode for the selected part's 3D marker.
  const [placingPart, setPlacingPart] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', fullName: '', role: 'TRAINEE', password: '' })
  const [saveMessage, setSaveMessage] = useState('')
  // Captured once rather than read live, so computing "recent" activity stays
  // a pure function of state/props during render.
  const [loadedAt] = useState(() => Date.now())

  const activePath = path || routes.admin
  // The module editor lives under /admin/modules/:slug, so the Training
  // Content section covers that path too.
  const editingModuleSlug = activePath.startsWith(`${routes.adminModules}/`)
    ? activePath.slice(routes.adminModules.length + 1)
    : null
  const isEquipmentSection =
    equipmentContentTabs.some(([tabPath]) => tabPath === activePath) || Boolean(editingModuleSlug)
  const moduleTitleBySlug = useMemo(() => {
    return content.modules.reduce((map, module) => ({ ...map, [module.slug]: module.title || module.fullTitle }), {})
  }, [content.modules])
  // Every equipment shares the same seven tab paths - these are the slices
  // of `content` scoped to whichever equipment section is currently open.
  const activeEquipmentModules = useMemo(
    () => content.modules.filter((module) => module.equipmentId === activeEquipmentId),
    [content.modules, activeEquipmentId],
  )
  const moduleBySlug = useMemo(
    () => content.modules.reduce((map, module) => ({ ...map, [module.slug]: module }), {}),
    [content.modules],
  )
  const activeEquipment = content.equipment.find((item) => item.id === activeEquipmentId) || null
  // Forklift keeps its own dedicated Parts/PartDetail + WalkAroundHotspot
  // systems regardless of this flag. For any other equipment, a configured
  // Model URL is what turns the Parts tab from a disabled note into the
  // generic EquipmentHotspotAdmin editor.
  const isForklift = activeEquipmentId === 'forklift'
  const hasModelForActiveEquipment = isForklift || Boolean(activeEquipment?.modelUrl)

  // Switching sections clears whatever was selected under the old one, so a
  // Backhoe screen never shows a stale Forklift module/checklist/quiz mid-edit.
  const openEquipmentSection = (equipmentId) => {
    setActiveEquipmentId(equipmentId)
    setEditingEquipment(content.equipment.find((item) => item.id === equipmentId) || null)
    onNavigate(routes.adminModules)
  }

  // The Overview tab is built entirely from data adminListContent() already
  // fetched (content.progress / content.activityLogs) - no extra API calls.
  const traineeCount = useMemo(() => content.users.filter((entry) => entry.role === 'TRAINEE').length, [content.users])
  const averageCompletion = useMemo(() => {
    if (!content.progress.length) return 0
    return Math.round(content.progress.reduce((sum, entry) => sum + entry.progress, 0) / content.progress.length)
  }, [content.progress])
  const recentActivityCount = useMemo(
    () => content.activityLogs.filter((entry) => loadedAt - new Date(entry.createdAt).getTime() <= 7 * DAY_MS).length,
    [content.activityLogs, loadedAt],
  )
  const moduleCompletion = useMemo(() => {
    const totals = {}
    for (const entry of content.progress) {
      const bucket = totals[entry.moduleSlug] || { sum: 0, count: 0 }
      bucket.sum += entry.progress
      bucket.count += 1
      totals[entry.moduleSlug] = bucket
    }
    return Object.entries(totals)
      .map(([slug, { sum, count }]) => ({
        slug,
        title: moduleTitleBySlug[slug] || slug,
        average: Math.round(sum / count),
      }))
      .sort((a, b) => b.average - a.average)
  }, [content.progress, moduleTitleBySlug])
  const recentActivity = useMemo(() => content.activityLogs.slice(0, 8), [content.activityLogs])

  useEffect(() => {
    adminListContent().then((data) => {
      setContent({
        equipment: [],
        modules: [],
        parts: [],
        partDetails: {},
        partCategories: [],
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
    setPlacingPart(false)
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

  // Category rows are short labels with no learner-visible body, so they save
  // immediately - the same rule as modules and checklist items.
  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    try {
      const result = await adminCreatePartCategory({ label: newCategory.trim() })
      setContent((current) => ({ ...current, partCategories: [...current.partCategories, result.category] }))
      setNewCategory('')
      refreshMessage('Category added.')
    } catch (error) {
      refreshMessage(error.message)
    }
  }

  const handleRenameCategory = async (category, label) => {
    const result = await adminUpdatePartCategory(category.id, { label })
    setContent((current) => ({
      ...current,
      partCategories: current.partCategories.map((entry) => (entry.id === category.id ? result.category : entry)),
    }))
  }

  const handleDeleteCategory = async (category) => {
    try {
      await adminDeletePartCategory(category.id)
      setContent((current) => ({
        ...current,
        partCategories: current.partCategories.filter((entry) => entry.id !== category.id),
      }))
      refreshMessage('Category deleted.')
    } catch (error) {
      refreshMessage(error.message)
    }
  }

  const handleAddEquipment = async () => {
    if (!newEquipmentTitle.trim()) return
    try {
      const result = await adminCreateEquipment({ title: newEquipmentTitle.trim() })
      setContent((current) => ({ ...current, equipment: [...current.equipment, result.equipment] }))
      setNewEquipmentTitle('')
      openEquipmentSection(result.equipment.id)
      // openEquipmentSection reads `content.equipment`, which has not
      // re-rendered with the new row yet, so the card editor is pointed at it
      // directly.
      setEditingEquipment(result.equipment)
      refreshMessage('Equipment created. Add its modules and hotspots, then tick Available.')
    } catch (error) {
      refreshMessage(error.message)
    }
  }

  const handleDeleteEquipment = async (equipment) => {
    if (!window.confirm(`Delete "${equipment.title}"? Only an equipment with no content of its own can be deleted.`)) return
    try {
      await adminDeleteEquipment(equipment.id)
      const remaining = content.equipment.filter((item) => item.id !== equipment.id)
      setContent((current) => ({ ...current, equipment: remaining }))
      if (remaining[0]) openEquipmentSection(remaining[0].id)
      refreshMessage('Equipment deleted.')
    } catch (error) {
      refreshMessage(error.message)
    }
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

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.fullName.trim() || !newUser.password) return
    try {
      const result = await adminCreateUser(newUser)
      setContent((current) => ({ ...current, users: [...current.users, result.user] }))
      setNewUser({ email: '', fullName: '', role: 'TRAINEE', password: '' })
      refreshMessage('User created.')
    } catch (err) {
      refreshMessage(err.message)
    }
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    try {
      const result = await adminUpdateUser(editingUser.id, editingUser)
      setContent((current) => ({
        ...current,
        users: current.users.map((entry) => (entry.id === editingUser.id ? result.user : entry)),
      }))
      setEditingUser({ ...result.user, password: '' })
      refreshMessage('User saved.')
    } catch (err) {
      refreshMessage(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user? Their saved progress is deleted with them.')) return
    try {
      await adminDeleteUser(userId)
      setContent((current) => ({ ...current, users: current.users.filter((entry) => entry.id !== userId) }))
      setEditingUser((current) => (current?.id === userId ? null : current))
      refreshMessage('User deleted.')
    } catch (err) {
      refreshMessage(err.message)
    }
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
          <button className="back-button" onClick={onBack}>Back to App</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          className={activePath === routes.admin ? 'active' : ''}
          onClick={() => onNavigate(routes.admin)}
        >
          <LayoutGrid size={16} />
          Overview
        </button>
        <button
          className={isEquipmentSection ? 'active' : ''}
          onClick={() => openEquipmentSection(activeEquipmentId)}
        >
          <Truck size={16} />
          Training Content
        </button>
        {trailingTabs.map(([tabPath, label, Icon]) => (
          <button
            key={tabPath}
            className={activePath === tabPath ? 'active' : ''}
            onClick={() => onNavigate(tabPath)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {isEquipmentSection && (
        <nav className="admin-equipment-picker" aria-label="Equipment">
          {content.equipment.map((equipment) => (
            <button
              key={equipment.id}
              className={activeEquipmentId === equipment.id ? 'active' : ''}
              onClick={() => openEquipmentSection(equipment.id)}
            >
              <Truck size={15} />
              {equipment.title}
            </button>
          ))}
          <span className="admin-equipment-add">
            <input
              value={newEquipmentTitle}
              placeholder="New equipment"
              onChange={(event) => setNewEquipmentTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleAddEquipment() }}
            />
            <button onClick={handleAddEquipment} disabled={!newEquipmentTitle.trim()}>Add</button>
          </span>
        </nav>
      )}

      {isEquipmentSection && (
        <nav className="admin-subtabs" aria-label={`${content.equipment.find((item) => item.id === activeEquipmentId)?.title || ''} content sections`}>
          {equipmentContentTabs.map(([tabPath, label, Icon]) => (
            <button
              key={tabPath}
              className={activePath === tabPath ? 'active' : ''}
              onClick={() => onNavigate(tabPath)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      )}

      {content.localOnly && (
        <div className="admin-alert">
          Frontend-only prototype mode is active. Admin changes are saved in this browser's localStorage.
        </div>
      )}

      {saveMessage && <div className="admin-save-message">{saveMessage}</div>}

      {activePath === routes.admin && (
        <main className="overview-grid">
          <div className="overview-stat-row">
            {[
              [UsersIcon, 'Learners', traineeCount],
              [TrendingUp, 'Average completion', `${averageCompletion}%`],
              [Layers, 'Modules published', content.modules.length],
              [Activity, 'Activity, last 7 days', recentActivityCount],
            ].map(([Icon, label, value]) => (
              <section key={label} className="overview-stat-card">
                <span className="overview-stat-icon"><Icon size={20} /></span>
                <div>
                  <strong>{value}</strong>
                  <p>{label}</p>
                </div>
              </section>
            ))}
          </div>

          <section className="admin-panel">
            <h2>Completion by module</h2>
            {moduleCompletion.length === 0 && <p className="admin-panel-note">No learner progress recorded yet.</p>}
            <div className="overview-meter-list">
              {moduleCompletion.map((entry) => (
                <div key={entry.slug} className="overview-meter-row">
                  <span className="overview-meter-label">{entry.title}</span>
                  <div className="overview-meter-track">
                    <div className="overview-meter-fill" style={{ width: `${entry.average}%` }} />
                  </div>
                  <span className="overview-meter-value">{entry.average}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <h2>Recent activity</h2>
            {recentActivity.length === 0 && <p className="admin-panel-note">No learner activity recorded yet.</p>}
            <ul className="overview-activity-list">
              {recentActivity.map((entry) => (
                <li key={entry.id}>
                  <span>{describeActivity(entry, moduleTitleBySlug[entry.detail])}</span>
                  <time>{formatRelativeTime(entry.createdAt)}</time>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}

      {activePath === routes.adminModules && (
        <main className="admin-grid">
          <ModuleListAdmin
            key={activeEquipmentId}
            equipmentId={activeEquipmentId}
            modules={activeEquipmentModules}
            onModulesChanged={(modules) => setContent((current) => ({
              ...current,
              modules: [
                ...current.modules.filter((module) => !modules.some((entry) => entry.id === module.id)),
                ...modules,
              ].filter((module) => module.equipmentId !== activeEquipmentId || modules.some((entry) => entry.id === module.id)),
            }))}
            onOpenModule={(module) => onNavigate(adminModuleRoute(module.slug))}
            onMessage={refreshMessage}
          />
        </main>
      )}

      {editingModuleSlug && (
        <main className="admin-grid admin-grid-single">
          {moduleBySlug[editingModuleSlug] ? (
            <ModuleEditor
              key={editingModuleSlug}
              module={moduleBySlug[editingModuleSlug]}
              isForklift={isForklift}
              checklists={content.checklists}
              quizQuestions={content.quizQuestions}
              onModuleChanged={(module) => setContent((current) => ({
                ...current,
                modules: current.modules.map((entry) => (entry.id === module.id ? module : entry)),
              }))}
              onChecklistsChanged={(checklists) => setContent((current) => ({ ...current, checklists }))}
              onQuizQuestionsChanged={(quizQuestions) => setContent((current) => ({ ...current, quizQuestions }))}
              onMessage={refreshMessage}
              onBack={() => onNavigate(routes.adminModules)}
            />
          ) : (
            <section className="admin-panel wide-panel">
              <p className="admin-panel-note">That module no longer exists.</p>
              <button className="admin-save" onClick={() => onNavigate(routes.adminModules)}>Back to modules</button>
            </section>
          )}
        </main>
      )}

      {activePath === routes.adminParts && !hasModelForActiveEquipment && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Parts Identification</h2>
            <p className="admin-panel-note">This equipment has no 3D model configured yet, so there is nothing to place part hotspots on.</p>
          </section>
        </main>
      )}

      {activePath === routes.adminParts && hasModelForActiveEquipment && !isForklift && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Hotspot Identification</h2>
            <p className="admin-panel-note">
              Click a point on the 3D model to place a hotspot, or drag an existing marker to reposition it.
              Edits are saved as a draft; learners keep the published position and text until you press Publish.
            </p>
            <EquipmentHotspotAdmin key={activeEquipmentId} equipmentId={activeEquipmentId} modelUrl={activeEquipment?.modelUrl} onMessage={refreshMessage} />
          </section>
          <section className="admin-panel wide-panel">
            <h2>Parts Quiz</h2>
            <QuizAdmin
              key={activeEquipmentId}
              scope={{ context: 'parts', equipmentId: activeEquipmentId }}
              questions={content.quizQuestions}
              onQuestionsChanged={(quizQuestions) => setContent((current) => ({ ...current, quizQuestions }))}
              onMessage={refreshMessage}
              note="The quiz step of this equipment's identification page. Scores feed its parts percentage; the step only appears once there is at least one question."
            />
          </section>
        </main>
      )}

      {activePath === routes.adminParts && hasModelForActiveEquipment && isForklift && (
        <main className="admin-grid">
          <section className="admin-panel admin-parts-list">
            <h2>Forklift Parts</h2>
            {content.parts.map((part) => (
              <button key={part.id} type="button" className={`admin-part-button ${selectedPart?.id === part.id ? 'is-active' : ''}`} onClick={() => selectPartForEditing(part)}>
                {part.label}
              </button>
            ))}
            <h2>Part Categories</h2>
            <p className="admin-panel-note">The filter chips above the parts list on the learner page. A category still used by a part cannot be deleted.</p>
            {content.partCategories.map((category) => (
              <div key={category.id} className="admin-row-actions">
                <input value={category.label} onChange={(event) => handleRenameCategory(category, event.target.value)} />
                <button onClick={() => handleDeleteCategory(category)}>Delete</button>
              </div>
            ))}
            <label>
              New category
              <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
            </label>
            <button className="admin-save" onClick={handleAddCategory} disabled={!newCategory.trim()}>Add category</button>

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

                <h3>Hotspot Position</h3>
                <p className="admin-panel-note">
                  Click a point on the model to place this part&apos;s marker, or drag the marker itself. The new
                  position saves with the rest of the draft.
                </p>
                <button
                  type="button"
                  className={placingPart ? 'admin-save' : ''}
                  onClick={() => setPlacingPart((value) => !value)}
                >
                  {placingPart ? 'Cancel placement' : 'Place on model'}
                </button>
                <div className="hotspot-editor-stage">
                  <InteractiveForkliftViewer
                    isAdmin
                    adminEditMode
                    placingActive={placingPart}
                    hotspots={[{ id: selectedPart.id, label: selectedPart.label, position: selectedPart.position || [0, 0.3, 0] }]}
                    onPlaceHotspot={(position) => { setSelectedPart({ ...selectedPart, position }); setPlacingPart(false) }}
                    onDragHotspot={(_id, position) => setSelectedPart({ ...selectedPart, position })}
                  />
                </div>
                <p className="admin-panel-note">
                  Position: {(selectedPart.position || [0, 0, 0]).map((value) => Number(value).toFixed(3)).join(', ')}
                </p>
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

          <section className="admin-panel wide-panel">
            <h2>Parts Quiz</h2>
            <QuizAdmin
              key={activeEquipmentId}
              scope={{ context: 'parts', equipmentId: activeEquipmentId }}
              questions={content.quizQuestions}
              onQuestionsChanged={(quizQuestions) => setContent((current) => ({ ...current, quizQuestions }))}
              onMessage={refreshMessage}
              note="The quiz step of this equipment's Parts Identification page. Scores feed its parts percentage."
            />
          </section>

          <section className="admin-panel wide-panel">
            <h2>Walk-Around Hotspots</h2>
            <p className="admin-panel-note">
              The inspection points of the Walk-Around Check simulation - a separate set from the parts above.
              Click the model to place one, or drag a marker to move it; edits publish separately.
            </p>
            <WalkAroundHotspotAdmin onMessage={refreshMessage} />
          </section>
        </main>
      )}

      {activePath === routes.adminSettings && (
        <main className="admin-grid">
          <section className="admin-panel admin-editor">
            <h2>Equipment Card</h2>
            <p className="admin-panel-note">The catalog card on the home screen (image, title, description, availability) plus the 3D model this equipment uses.</p>
            {editingEquipment ? (
              <>
                <label>Title<input value={editingEquipment.title} onChange={(event) => setEditingEquipment({ ...editingEquipment, title: event.target.value })} /></label>
                <label>Description<textarea value={editingEquipment.description} onChange={(event) => setEditingEquipment({ ...editingEquipment, description: event.target.value })} /></label>
                <label>Image URL<input value={editingEquipment.imageUrl || ''} onChange={(event) => setEditingEquipment({ ...editingEquipment, imageUrl: event.target.value })} /></label>
                <label>Model URL<input value={editingEquipment.modelUrl || ''} placeholder="/models/backhoe.glb" onChange={(event) => setEditingEquipment({ ...editingEquipment, modelUrl: event.target.value })} /></label>
                <p className="admin-panel-note">Turns on the Parts Identification hotspot editor and the learner-facing identification page for this equipment.</p>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={editingEquipment.available !== false}
                    onChange={(event) => setEditingEquipment({ ...editingEquipment, available: event.target.checked })}
                  />
                  Available for training
                </label>
                <p className="admin-panel-note">Unchecked renders the catalog card as a non-interactive &quot;Coming Soon&quot; placeholder.</p>
                <div className="admin-row-actions">
                  <button className="admin-save" onClick={handleSaveEquipment}>Save equipment card</button>
                  <button onClick={() => handleDeleteEquipment(editingEquipment)}>Delete equipment</button>
                </div>
                <p className="admin-panel-note">Deleting is refused while the equipment still has modules, hotspots or quiz questions.</p>
              </>
            ) : <p>No equipment card available.</p>}
          </section>
          <section className="admin-panel admin-editor">
            <h2>Hub Content</h2>
            <HubContentEditor
              key={activeEquipment?.id || 'none'}
              equipment={activeEquipment}
              moduleTitles={activeEquipmentModules.map((module) => module.subtitle || module.title)}
              hasPartsPage={hasModelForActiveEquipment}
              onSaved={(equipment) => {
                setContent((current) => ({
                  ...current,
                  equipment: current.equipment.map((item) => (item.id === equipment.id ? equipment : item)),
                }))
                setEditingEquipment((current) => (current?.id === equipment.id ? equipment : current))
              }}
              onMessage={refreshMessage}
            />
          </section>
          <section className="admin-panel admin-editor wide-panel">
            <h2>Driving Simulation</h2>
            <VehicleProfileEditor
              key={activeEquipment?.id || 'none'}
              equipment={activeEquipment}
              onSaved={(equipment) => {
                setContent((current) => ({
                  ...current,
                  equipment: current.equipment.map((item) => (item.id === equipment.id ? equipment : item)),
                }))
                setEditingEquipment((current) => (current?.id === equipment.id ? equipment : current))
              }}
              onMessage={refreshMessage}
            />
          </section>
        </main>
      )}

      {activePath === routes.adminUsers && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Users</h2>
            {content.users.map((learner) => (
              <article key={learner.id} className={`admin-list-item ${editingUser?.id === learner.id ? 'is-editing' : ''}`}>
                <h3>{learner.fullName}</h3>
                <p>{learner.email} - {learner.role}</p>
                <div className="admin-row-actions">
                  <button onClick={() => setEditingUser({ ...learner, password: '' })}>Edit</button>
                  {learner.id !== user.id && (
                    <button onClick={() => handleDeleteUser(learner.id)}>Delete</button>
                  )}
                </div>
              </article>
            ))}
          </section>
          <section className="admin-panel admin-editor">
            <h2>New user</h2>
            <label>
              Full name
              <input value={newUser.fullName} onChange={(event) => setNewUser({ ...newUser, fullName: event.target.value })} />
            </label>
            <label>
              Email
              <input value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} />
            </label>
            <label>
              Password
              <input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} />
            </label>
            <label>
              Role
              <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                <option value="TRAINEE">Trainee</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <button className="admin-save" onClick={handleCreateUser}>Create user</button>
          </section>
          <section className="admin-panel admin-editor">
            <h2>Edit user</h2>
            {editingUser ? (
              <>
                <label>Full name<input value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} /></label>
                <label>Email<input value={editingUser.email} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} /></label>
                <label>
                  New password
                  <input
                    type="password"
                    value={editingUser.password}
                    placeholder="Leave blank to keep the current password"
                    onChange={(event) => setEditingUser({ ...editingUser, password: event.target.value })}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={editingUser.role}
                    disabled={editingUser.id === user.id}
                    onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value })}
                  >
                    <option value="TRAINEE">Trainee</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                {editingUser.id === user.id && <p className="admin-panel-note">You cannot change your own role.</p>}
                <button className="admin-save" onClick={handleSaveUser}>Save user</button>
              </>
            ) : <p>Select a user to edit.</p>}
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
