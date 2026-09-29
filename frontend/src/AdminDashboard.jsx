import { useEffect, useMemo, useRef, useState } from 'react'
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
import ModuleListAdmin from './components/admin/ModuleListAdmin'
import QuizAdmin from './components/admin/QuizAdmin'
import ReportsPanel from './components/admin/ReportsPanel'
import VehicleProfileEditor from './components/admin/VehicleProfileEditor'
import { Button } from './components/ui/button'
import { Panel, PanelHeader, PanelNote } from './components/ui/panel'
import { Field } from './components/ui/field'
import { Input, Textarea, Select, Checkbox } from './components/ui/input'
import { Toolbar } from './components/ui/toolbar'
import { Stat, Meter } from './components/ui/stat'
import { Toast } from './components/ui/toast'
import { usePageTitle } from './hooks/usePageTitle'
import { describeActivity, formatRelativeTime } from './lib/adminActivity'
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

// Everything but the dashboard root gets its own tab label appended to
// "Admin Panel" for the tab title; the module editor's label comes from the
// module being edited instead, since it has no static path of its own.
const ADMIN_SECTION_LABELS = Object.fromEntries(
  [...equipmentContentTabs, ...trailingTabs].map(([path, label]) => [path, label]),
)

const DAY_MS = 24 * 60 * 60 * 1000

// The shape of adminListContent()'s response - used both as the initial state
// (nothing has loaded yet) and as the base a fetch's response is spread over,
// so a field the current backend doesn't send still renders as an empty list
// instead of undefined.
const EMPTY_ADMIN_CONTENT = {
  equipment: [],
  modules: [],
  hotspotCategories: [],
  checklists: [],
  quizQuestions: [],
  users: [],
  progress: [],
  activityLogs: [],
}

// Shared shell for every tab body: centred, capped width, responsive padding.
// `twoCol` gives panels a two-column desktop layout (Panel's `wide` prop then
// spans both) - single-column tabs (Overview, the module list, the module
// editor) omit it.
const CONTENT_WRAP = 'mx-auto grid w-full max-w-[1680px] grid-cols-1 gap-5 px-5 py-6 md:px-8 md:py-7'
const TWO_COL = 'md:grid-cols-2'

const NAV_TAB_CLASSES = (active) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
    active ? 'bg-accent text-white' : 'text-muted hover:bg-white hover:text-ink'
  }`

const SUBNAV_TAB_CLASSES = (active) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
    active ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:bg-slate-100 hover:text-ink'
  }`

// Local draft so typing a category name doesn't PATCH on every keystroke -
// commits once, on blur or Enter, only when the label actually changed.
function CategoryRow({ category, onRename, onDelete }) {
  const [draft, setDraft] = useState(category.label)
  // Adjusted during render rather than in an effect, so an external label
  // change (the server's response to a rename, or switching equipment)
  // takes effect in the same render instead of flashing the stale value
  // for one paint - see https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedLabel, setSyncedLabel] = useState(category.label)
  if (category.label !== syncedLabel) {
    setSyncedLabel(category.label)
    setDraft(category.label)
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== category.label) {
      onRename(category, trimmed)
    } else {
      setDraft(category.label)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        className="flex-1"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.target.blur()
        }}
      />
      <Button variant="danger" size="sm" onClick={() => onDelete(category)}>Delete</Button>
    </div>
  )
}

function AdminDashboard({ user, onBack, path, onNavigate }) {
  const [content, setContent] = useState(EMPTY_ADMIN_CONTENT)
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
  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState(null)
  const saveMessageTimer = useRef(null)
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

  usePageTitle(
    editingModuleSlug
      ? `Admin Panel - ${moduleTitleBySlug[editingModuleSlug] || 'Module Editor'}`
      : ADMIN_SECTION_LABELS[activePath]
        ? `Admin Panel - ${ADMIN_SECTION_LABELS[activePath]}`
        : 'Admin Panel',
  )
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
    const equipment = content.equipment.find((item) => item.id === equipmentId)

    return {
      id: equipmentId,
      record: equipment || null,
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
    adminListContent()
      .then((data) => {
        setContent({ ...EMPTY_ADMIN_CONTENT, ...data })
        setEditingEquipment((current) => current || data.equipment?.[0] || null)
        // First row in sortOrder, whatever it is - the dashboard should open on
        // real content rather than on a named equipment that may not exist.
        setActiveEquipmentId((current) => current || data.equipment?.[0]?.id || null)
        setContentLoading(false)
      })
      .catch((err) => {
        setContentError(err.message)
        setContentLoading(false)
      })
  }, [])

  useEffect(() => () => clearTimeout(saveMessageTimer.current), [])

  const refreshMessage = (message) => {
    setSaveMessage(message)
    clearTimeout(saveMessageTimer.current)
    saveMessageTimer.current = window.setTimeout(() => setSaveMessage(''), 2400)
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

  return (
    <div className="min-h-svh bg-bg text-left text-ink">
      <div className="sticky top-0 z-20">
        <header className="flex flex-wrap items-start justify-between gap-4.5 border-b border-border bg-panel px-8 py-4">
          <div>
            <p className="m-0 text-[13px] font-semibold text-accent-strong">GearView3D Admin</p>
            <h1 className="my-1 text-[22px] font-extrabold text-ink">Content Management</h1>
            <p className="m-0 text-[13px] text-muted">Signed in as {user?.email}</p>
          </div>
          <div className="flex flex-none gap-2.5 pt-0.5">
            <Button variant="secondary" onClick={onBack}>Back to App</Button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-border bg-slate-100 px-8 py-2" aria-label="Admin sections">
          <button className={NAV_TAB_CLASSES(activePath === routes.admin)} onClick={() => onNavigate(routes.admin)}>
            <LayoutGrid size={16} />
            Overview
          </button>
          <button className={NAV_TAB_CLASSES(isEquipmentSection)} onClick={() => openEquipmentSection(activeEquipmentId)}>
            <Truck size={16} />
            Training Content
          </button>
          {trailingTabs.map(([tabPath, label, Icon]) => (
            <button key={tabPath} className={NAV_TAB_CLASSES(activePath === tabPath)} onClick={() => onNavigate(tabPath)}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {isEquipmentSection && (
          <nav className="flex flex-wrap gap-1.5 border-b border-border bg-bg px-8 py-2.5" aria-label="Equipment">
            {content.equipment.map((equipment) => (
              <button
                key={equipment.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold transition ${
                  activeEquipmentId === equipment.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-slate-300 bg-panel text-body hover:border-accent'
                }`}
                onClick={() => openEquipmentSection(equipment.id)}
              >
                <Truck size={15} />
                {equipment.title}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Input
                className="w-40"
                value={newEquipmentTitle}
                placeholder="New equipment"
                onChange={(event) => setNewEquipmentTitle(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleAddEquipment() }}
              />
              <Button size="sm" variant="secondary" onClick={handleAddEquipment} disabled={!newEquipmentTitle.trim()}>Add</Button>
            </span>
          </nav>
        )}

        {isEquipmentSection && (
          <nav
            className="flex flex-wrap gap-1 border-b border-border bg-panel px-8 py-1.5 md:pl-[52px]"
            aria-label={`${content.equipment.find((item) => item.id === activeEquipmentId)?.title || ''} content sections`}
          >
            {equipmentContentTabs.map(([tabPath, label, Icon]) => (
              <button key={tabPath} className={SUBNAV_TAB_CLASSES(activePath === tabPath)} onClick={() => onNavigate(tabPath)}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {contentError && (
        <div className="mx-auto mt-4.5 w-[min(1680px,100%)] rounded-xl border border-amber-300 bg-amber-50 px-8 py-3 text-amber-800">
          Admin content could not be loaded: {contentError}
        </div>
      )}

      <Toast>{saveMessage}</Toast>

      {contentLoading ? (
        <main className={CONTENT_WRAP}>
          <PanelNote>Loading admin content...</PanelNote>
        </main>
      ) : (
        <>
          {activePath === routes.admin && (
            <main className={CONTENT_WRAP}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat icon={UsersIcon} value={traineeCount} label="Learners" />
                <Stat icon={TrendingUp} value={`${averageCompletion}%`} label="Average completion" />
                <Stat icon={Layers} value={content.modules.length} label="Modules published" />
                <Stat icon={Activity} value={recentActivityCount} label="Activity, last 7 days" />
              </div>

              <Panel>
                <PanelHeader>Completion by module</PanelHeader>
                {moduleCompletion.length === 0 && <PanelNote>No learner progress recorded yet.</PanelNote>}
                <div className="grid gap-3">
                  {moduleCompletion.map((entry) => (
                    <Meter key={entry.slug} label={entry.title} value={entry.average} />
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelHeader>Recent activity</PanelHeader>
                {recentActivity.length === 0 && <PanelNote>No learner activity recorded yet.</PanelNote>}
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-4 border-t border-slate-200 py-2.5 text-[13.5px] text-body first:border-t-0">
                      <span>{describeActivity(entry, moduleTitleBySlug[entry.detail])}</span>
                      <time className="flex-none text-xs font-semibold text-muted">{formatRelativeTime(entry.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              </Panel>
            </main>
          )}

          {activePath === routes.adminModules && activeEquipmentId && (
            <main className={CONTENT_WRAP}>
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
            <main className={CONTENT_WRAP}>
              {moduleBySlug[editingModuleSlug] ? (
                <ModuleEditor
                  key={editingModuleSlug}
                  module={moduleBySlug[editingModuleSlug]}
                  equipment={editingModuleEquipment.record}
                  equipmentId={editingModuleEquipment.id}
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
                <Panel wide>
                  <PanelNote>That module no longer exists.</PanelNote>
                  <Toolbar>
                    <Button onClick={() => onNavigate(routes.adminModules)}>Back to modules</Button>
                  </Toolbar>
                </Panel>
              )}
            </main>
          )}

          {activePath === routes.adminParts && !hasModelForActiveEquipment && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel wide>
                <PanelHeader>Parts Identification</PanelHeader>
                <PanelNote>This equipment has no 3D model configured yet, so there is nothing to place part hotspots on.</PanelNote>
              </Panel>
            </main>
          )}

          {activePath === routes.adminParts && hasModelForActiveEquipment && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel wide>
                <PanelHeader>Parts Identification</PanelHeader>
                <PanelNote>
                  Click a point on the 3D model to place a part&apos;s marker, or drag an existing marker to move it.
                  Edits are saved as a draft; learners keep the published position and text until you press Publish.
                </PanelNote>
                <HotspotAdmin
                  key={activeEquipmentId}
                  equipmentId={activeEquipmentId}
                  categories={activeEquipmentCategories}
                  surface="parts"
                  onMessage={refreshMessage}
                />
              </Panel>

              <Panel>
                <PanelHeader>Part Categories</PanelHeader>
                <PanelNote>The filter chips above the parts list on the learner page. A category still used by a part cannot be deleted.</PanelNote>
                <div className="mt-3 grid gap-2.5">
                  {activeEquipmentCategories.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      onRename={handleRenameCategory}
                      onDelete={handleDeleteCategory}
                    />
                  ))}
                </div>
                <Field label="New category" className="mt-3.5">
                  <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
                </Field>
                <Toolbar>
                  <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>Add category</Button>
                </Toolbar>
              </Panel>

              <Panel wide>
                <PanelHeader>Parts Quiz</PanelHeader>
                <QuizAdmin
                  key={activeEquipmentId}
                  scope={{ context: 'parts', equipmentId: activeEquipmentId }}
                  questions={content.quizQuestions}
                  onQuestionsChanged={(quizQuestions) => setContent((current) => ({ ...current, quizQuestions }))}
                  onMessage={refreshMessage}
                  note="The quiz step of this equipment's Parts Identification page. Scores feed its parts percentage."
                />
              </Panel>
            </main>
          )}

          {activePath === routes.adminSettings && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel>
                <PanelHeader>Equipment Card</PanelHeader>
                <PanelNote>The catalog card on the home screen (image, title, description, availability).</PanelNote>
                {editingEquipment ? (
                  <div className="mt-3.5 grid gap-3.5">
                    <Field label="Title">
                      <Input value={editingEquipment.title} onChange={(event) => setEditingEquipment({ ...editingEquipment, title: event.target.value })} />
                    </Field>
                    <Field label="Description">
                      <Textarea value={editingEquipment.description} onChange={(event) => setEditingEquipment({ ...editingEquipment, description: event.target.value })} />
                    </Field>
                    <Field
                      label="Catalog image URL"
                      note={<>The picture on this equipment&apos;s catalogue card. Drop the file in <code>frontend/public/images/</code> and point at it as <code>/images/your-file.png</code>, or paste any image URL. Left blank, the card shows a plain panel - there is no default picture.</>}
                    >
                      <Input
                        value={editingEquipment.imageUrl || ''}
                        placeholder="/images/backhoe-card.png"
                        onChange={(event) => setEditingEquipment({ ...editingEquipment, imageUrl: event.target.value })}
                      />
                    </Field>
                    <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-lg border border-border bg-ink">
                      {editingEquipment.imageUrl ? (
                        <img
                          className="h-full w-full object-cover data-[broken=true]:object-contain data-[broken=true]:opacity-40"
                          src={editingEquipment.imageUrl}
                          alt=""
                          onError={(event) => { event.currentTarget.dataset.broken = 'true' }}
                          onLoad={(event) => { delete event.currentTarget.dataset.broken }}
                        />
                      ) : (
                        <span className="text-sm text-slate-400">No image set</span>
                      )}
                    </div>
                    <Checkbox
                      label="Available for training"
                      checked={editingEquipment.available !== false}
                      onChange={(event) => setEditingEquipment({ ...editingEquipment, available: event.target.checked })}
                    />
                    <PanelNote>Unchecked renders the catalog card as a non-interactive &quot;Coming Soon&quot; placeholder.</PanelNote>
                    <Toolbar>
                      <Button onClick={handleSaveEquipment}>Save equipment card</Button>
                      <Button variant="danger" onClick={() => handleDeleteEquipment(editingEquipment)}>Delete equipment</Button>
                    </Toolbar>
                    <PanelNote>Deleting is refused while the equipment still has modules, hotspots or quiz questions.</PanelNote>
                  </div>
                ) : <p className="mt-3.5 text-sm text-body">No equipment card available.</p>}
              </Panel>
              <Panel>
                <PanelHeader>Hub Content</PanelHeader>
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
              </Panel>
              <Panel wide>
                <PanelHeader>Driving Simulation</PanelHeader>
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
              </Panel>
            </main>
          )}

          {activePath === routes.adminUsers && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel wide>
                <PanelHeader>Users</PanelHeader>
                <div className="grid gap-0.5">
                  {content.users.map((learner) => (
                    <article
                      key={learner.id}
                      className={`-mx-2.5 rounded-lg px-2.5 py-3 transition first:border-t-0 border-t ${
                        editingUser?.id === learner.id
                          ? 'border-t-transparent bg-accent-soft [&+article]:border-t-transparent'
                          : 'border-t-slate-200'
                      }`}
                    >
                      <h3 className="m-0 mb-1.5 text-sm font-extrabold text-ink">{learner.fullName}</h3>
                      <p className="text-[13px] text-muted">{learner.email} - {learner.role}</p>
                      <Toolbar>
                        <Button size="sm" variant="secondary" onClick={() => setEditingUser({ ...learner, password: '' })}>Edit</Button>
                        {learner.id !== user.id && (
                          <Button size="sm" variant="danger" onClick={() => handleDeleteUser(learner.id)}>Delete</Button>
                        )}
                      </Toolbar>
                    </article>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelHeader>New user</PanelHeader>
                <div className="grid gap-3.5">
                  <Field label="Full name">
                    <Input value={newUser.fullName} onChange={(event) => setNewUser({ ...newUser, fullName: event.target.value })} />
                  </Field>
                  <Field label="Email">
                    <Input value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} />
                  </Field>
                  <Field label="Password">
                    <Input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} />
                  </Field>
                  <Field label="Role">
                    <Select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                      <option value="TRAINEE">Trainee</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                  </Field>
                  <Toolbar>
                    <Button onClick={handleCreateUser}>Create user</Button>
                  </Toolbar>
                </div>
              </Panel>
              <Panel>
                <PanelHeader>Edit user</PanelHeader>
                {editingUser ? (
                  <div className="mt-3.5 grid gap-3.5">
                    <Field label="Full name">
                      <Input value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} />
                    </Field>
                    <Field label="Email">
                      <Input value={editingUser.email} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} />
                    </Field>
                    <Field label="New password">
                      <Input
                        type="password"
                        value={editingUser.password}
                        placeholder="Leave blank to keep the current password"
                        onChange={(event) => setEditingUser({ ...editingUser, password: event.target.value })}
                      />
                    </Field>
                    <Field label="Role">
                      <Select
                        value={editingUser.role}
                        disabled={editingUser.id === user.id}
                        onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value })}
                      >
                        <option value="TRAINEE">Trainee</option>
                        <option value="ADMIN">Admin</option>
                      </Select>
                    </Field>
                    {editingUser.id === user.id && <PanelNote>You cannot change your own role.</PanelNote>}
                    <Toolbar>
                      <Button onClick={handleSaveUser}>Save user</Button>
                    </Toolbar>
                  </div>
                ) : <p className="mt-3.5 text-sm text-body">Select a user to edit.</p>}
              </Panel>
            </main>
          )}

          {activePath === routes.adminReports && (
            <main className={CONTENT_WRAP}>
              <ReportsPanel
                equipment={content.equipment}
                modules={content.modules}
                users={content.users}
                progress={content.progress}
                activityLogs={content.activityLogs}
              />
            </main>
          )}
        </>
      )}
    </div>
  )
}

export default AdminDashboard
