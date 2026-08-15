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
import HubContentEditor from './components/admin/HubContentEditor'
import ModuleEditor from './components/admin/ModuleEditor'
import HotspotAdmin from './components/admin/HotspotAdmin'
import HotspotViewer from './components/HotspotViewer'
import ModuleListAdmin from './components/admin/ModuleListAdmin'
import QuizAdmin from './components/admin/QuizAdmin'
import VehicleProfileEditor from './components/admin/VehicleProfileEditor'
import {
  adminCreateEquipment,
  adminCreateHotspotCategory,
  adminCreateUser,
  adminDeleteEquipment,
  adminDeleteHotspotCategory,
  adminDeleteUser,
  adminListContent,
  adminUpdateEquipment,
  adminUpdateHotspotCategory,
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
  if (entry.action === 'parts_quiz_attempt') return `${who} scored ${entry.detail} on the parts quiz`
  return `${who} - ${entry.action}`
}

function AdminDashboard({ user, onBack, path, onNavigate }) {
  const [content, setContent] = useState({
    equipment: [],
    modules: [],
    hotspotCategories: [],
    checklists: [],
    quizQuestions: [],
    users: [],
    progress: [],
    activityLogs: [],
    localOnly: true,
  })
  const [editingEquipment, setEditingEquipment] = useState(null)
  // Which equipment's section is expanded in the nav - the sub-tab paths are
  // shared by every equipment, so this (not the URL) decides whose
  // modules/parts/settings the tab bodies below show. Null until the first
  // fetch picks the first equipment row: naming one here would make the
  // dashboard wrong for a deployment that has no forklift.
  const [activeEquipmentId, setActiveEquipmentId] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [newCategory, setNewCategory] = useState('')
  const [newEquipmentTitle, setNewEquipmentTitle] = useState('')
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
  const activeEquipmentCategories = useMemo(
    () => content.hotspotCategories.filter((category) => category.equipmentId === activeEquipmentId),
    [content.hotspotCategories, activeEquipmentId],
  )
  // The Module Editor scopes to the *module's own* equipment, not the picker's.
  // /admin/modules/:slug is a real URL an admin can land on directly, and
  // `activeEquipmentId` is picker state - so scoping off it showed a Backhoe
  // module the Forklift's sibling modules, model and categories.
  const editingModuleEquipment = useMemo(() => {
    const equipmentId = moduleBySlug[editingModuleSlug]?.equipmentId || activeEquipmentId

    return {
      id: equipmentId,
      modelUrl: content.equipment.find((item) => item.id === equipmentId)?.modelUrl,
      modules: content.modules.filter((module) => module.equipmentId === equipmentId),
      categories: content.hotspotCategories.filter((category) => category.equipmentId === equipmentId),
    }
  }, [moduleBySlug, editingModuleSlug, activeEquipmentId, content.equipment, content.modules, content.hotspotCategories])
  // A configured Model URL is what turns the Parts tab from a disabled note
  // into the hotspot editor - there is nothing to place markers on without one.
  const hasModelForActiveEquipment = Boolean(activeEquipment?.modelUrl)

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
        hotspotCategories: [],
        checklists: [],
        quizQuestions: [],
        users: [],
        progress: [],
        activityLogs: [],
        localOnly: true,
        ...data,
      })
      setEditingEquipment((current) => current || data.equipment?.[0] || null)
      // First row in sortOrder, whatever it is - the dashboard should open on
      // real content rather than on a named equipment that may not exist.
      setActiveEquipmentId((current) => current || data.equipment?.[0]?.id || null)
    })
  }, [])

  const refreshMessage = (message) => {
    setSaveMessage(message)
    window.setTimeout(() => setSaveMessage(''), 2400)
  }

  // Category rows are short labels with no learner-visible body, so they save
  // immediately - the same rule as modules and checklist items.
  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    try {
      const result = await adminCreateHotspotCategory({ equipmentId: activeEquipmentId, label: newCategory.trim() })
      setContent((current) => ({ ...current, hotspotCategories: [...current.hotspotCategories, result.category] }))
      setNewCategory('')
      refreshMessage('Category added.')
    } catch (error) {
      refreshMessage(error.message)
    }
  }

  const handleRenameCategory = async (category, label) => {
    const result = await adminUpdateHotspotCategory(category.id, { label })
    setContent((current) => ({
      ...current,
      hotspotCategories: current.hotspotCategories.map((entry) => (entry.id === category.id ? result.category : entry)),
    }))
  }

  const handleDeleteCategory = async (category) => {
    try {
      await adminDeleteHotspotCategory(category.id)
      setContent((current) => ({
        ...current,
        hotspotCategories: current.hotspotCategories.filter((entry) => entry.id !== category.id),
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

      {activePath === routes.adminModules && activeEquipmentId && (
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
              equipmentId={editingModuleEquipment.id}
              modelUrl={editingModuleEquipment.modelUrl}
              modelScale={editingModuleEquipment.modelScale}
              modelOffsetY={editingModuleEquipment.modelOffsetY}
              equipmentModules={editingModuleEquipment.modules}
              checklists={content.checklists}
              hotspotCategories={editingModuleEquipment.categories}
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

      {activePath === routes.adminParts && hasModelForActiveEquipment && (
        <main className="admin-grid">
          <section className="admin-panel wide-panel">
            <h2>Parts Identification</h2>
            <p className="admin-panel-note">
              Click a point on the 3D model to place a part&apos;s marker, or drag an existing marker to move it.
              Edits are saved as a draft; learners keep the published position and text until you press Publish.
            </p>
            <HotspotAdmin
              key={activeEquipmentId}
              equipmentId={activeEquipmentId}
              modelUrl={activeEquipment?.modelUrl}
              modelScale={activeEquipment?.modelScale}
              modelOffsetY={activeEquipment?.modelOffsetY}
              categories={activeEquipmentCategories}
              surface="parts"
              onMessage={refreshMessage}
            />
          </section>

          <section className="admin-panel admin-editor">
            <h2>Part Categories</h2>
            <p className="admin-panel-note">The filter chips above the parts list on the learner page. A category still used by a part cannot be deleted.</p>
            {activeEquipmentCategories.map((category) => (
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
                <label>
                  Catalog image URL
                  <input
                    value={editingEquipment.imageUrl || ''}
                    placeholder="/images/backhoe-card.png"
                    onChange={(event) => setEditingEquipment({ ...editingEquipment, imageUrl: event.target.value })}
                  />
                  <small className="admin-field-note">
                    The picture on this equipment&apos;s catalogue card. Drop the file in
                    {' '}<code>frontend/public/images/</code> and point at it as <code>/images/your-file.png</code>, or paste
                    any image URL. Left blank, the card shows a plain panel - there is no default picture.
                  </small>
                </label>
                <div className="equipment-image-preview">
                  {editingEquipment.imageUrl ? (
                    <img
                      src={editingEquipment.imageUrl}
                      alt=""
                      onError={(event) => { event.currentTarget.dataset.broken = 'true' }}
                      onLoad={(event) => { delete event.currentTarget.dataset.broken }}
                    />
                  ) : (
                    <span>No image set</span>
                  )}
                </div>
                <label>Model URL<input value={editingEquipment.modelUrl || ''} placeholder="/models/backhoe.glb" onChange={(event) => setEditingEquipment({ ...editingEquipment, modelUrl: event.target.value })} /></label>
                <p className="admin-panel-note">Turns on the Parts Identification hotspot editor and the learner-facing identification page for this equipment.</p>
                <label>
                  Model scale
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingEquipment.modelScale ?? ''}
                    placeholder="1"
                    onChange={(event) => setEditingEquipment({
                      ...editingEquipment,
                      modelScale: event.target.value === '' ? null : Number(event.target.value),
                    })}
                  />
                </label>
                <p className="admin-panel-note">
                  Multiplier applied to this model everywhere it renders (Parts Identification, Walk-Around markers,
                  the placement stage below). Forklift.glb is the scale baseline - use &quot;Show scale reference&quot; below
                  to compare this model against it, an average adult (1.7 m) and a cardboard box, live as you edit the
                  scale. Leave blank for 1x. Changing this after hotspots are placed moves the model without moving
                  their markers, so set the scale first, then place or re-check markers.
                </p>
                <label>
                  Model height offset
                  <input
                    type="number"
                    step="0.005"
                    value={editingEquipment.modelOffsetY ?? ''}
                    placeholder="0"
                    onChange={(event) => setEditingEquipment({
                      ...editingEquipment,
                      modelOffsetY: event.target.value === '' ? null : Number(event.target.value),
                    })}
                  />
                </label>
                <p className="admin-panel-note">
                  Nudges the model up (positive) or down (negative) after the viewer stands it on the floor. Only needed
                  when the model&apos;s lowest point is not its wheels - backhoe.glb&apos;s buckets hang below its tyres, so
                  grounding it leaves the tyres in the air. Measured in the same units as the scene, after the scale
                  above, so set the scale first. Leave blank for none, and nudge in small steps against the preview.
                </p>
                {editingEquipment.modelUrl && (
                  <div className="equipment-scale-preview">
                    <HotspotViewer
                      key={editingEquipment.id}
                      modelUrl={editingEquipment.modelUrl}
                      modelScale={editingEquipment.modelScale}
                      modelOffsetY={editingEquipment.modelOffsetY}
                      isAdmin
                    />
                  </div>
                )}
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
