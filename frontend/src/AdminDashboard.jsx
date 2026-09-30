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
import EquipmentCardEditor from './components/admin/EquipmentCardEditor'
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
import { Input, Select } from './components/ui/input'
import { Toolbar } from './components/ui/toolbar'
import { Stat, Meter } from './components/ui/stat'
import { Toast } from './components/ui/toast'
import { usePageTitle } from './hooks/usePageTitle'
import { describeActivity, formatRelativeTime } from './lib/adminActivity'
import {
  adminCreateHotspotCategory,
  adminCreateUser,
  adminDeleteHotspotCategory,
  adminDeleteUser,
  adminListContent,
  adminResetUserProgress,
  adminUpdateHotspotCategory,
  adminUpdateUser,
} from './lib/api'
import { adminModuleRoute, routes } from './lib/router'
import { can, canActOnRole, canOpenDashboard, ROLE_LABELS, ROLES } from './data/permissions.js'

// The three sections under Training Content. Steps, checklist items and quiz
// questions have no section of their own - they live inside a module.
//
// Each tab names the permission it needs. Hiding a tab is only presentation:
// the API refuses the same calls with a 403 (backend/src/routes/admin.js).
const trainingContentTabs = [
  [routes.adminModules, 'Modules', Layers, 'content.edit'],
  [routes.adminParts, 'Parts Identification', Wrench, 'content.edit'],
  [routes.adminSettings, 'Equipment Settings', Wrench, 'equipment.edit'],
]

// Module-level so QuizAdmin gets one stable object.
const PARTS_QUIZ_SCOPE = { context: 'parts' }

const trailingTabs = [
  [routes.adminUsers, 'Users', UsersIcon, 'users.view'],
  [routes.adminReports, 'Reports', BarChart3, 'progress.view'],
]

const EMPTY_NEW_USER = { email: '', fullName: '', role: 'TRAINEE', password: '' }

// The permission a dashboard path needs; the module editor is content.
function sectionPermission(path) {
  if (path.startsWith(`${routes.adminModules}/`)) return 'content.edit'
  return [...trainingContentTabs, ...trailingTabs].find(([tabPath]) => tabPath === path)?.[3] || null
}

// Everything but the dashboard root gets its own tab label appended to
// "Admin Panel" for the tab title; the module editor's label comes from the
// module being edited instead, since it has no static path of its own.
const ADMIN_SECTION_LABELS = Object.fromEntries(
  [...trainingContentTabs, ...trailingTabs].map(([path, label]) => [path, label]),
)

const DAY_MS = 24 * 60 * 60 * 1000

// The shape of adminListContent()'s response - used both as the initial state
// (nothing has loaded yet) and as the base a fetch's response is spread over,
// so a field the current backend doesn't send still renders as empty instead
// of undefined.
const EMPTY_ADMIN_CONTENT = {
  equipment: null,
  partsHotspotCount: 0,
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
  // change (the server's response to a rename) takes effect in the same render instead of flashing the stale value
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
  const [editingUser, setEditingUser] = useState(null)
  const [newCategory, setNewCategory] = useState('')
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [saveMessage, setSaveMessage] = useState('')
  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState(null)
  const saveMessageTimer = useRef(null)
  // Captured once rather than read live, so computing "recent" activity stays
  // a pure function of state/props during render.
  const [loadedAt] = useState(() => Date.now())

  const activePath = path || routes.admin
  const allowedContentTabs = trainingContentTabs.filter(([, , , permission]) => can(user, permission))
  const allowedTrailingTabs = trailingTabs.filter(([, , , permission]) => can(user, permission))
  const requiredPermission = sectionPermission(activePath)
  const sectionAllowed = !requiredPermission || can(user, requiredPermission)
  const canManageUsers = can(user, 'users.manage')
  // The module editor lives under /admin/modules/:slug, so the Training
  // Content section covers that path too.
  const editingModuleSlug = activePath.startsWith(`${routes.adminModules}/`)
    ? activePath.slice(routes.adminModules.length + 1)
    : null
  const isTrainingContentSection =
    trainingContentTabs.some(([tabPath]) => tabPath === activePath) || Boolean(editingModuleSlug)
  const trainingContentHome = allowedContentTabs[0]?.[0]
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
  const moduleBySlug = useMemo(
    () => content.modules.reduce((map, module) => ({ ...map, [module.slug]: module }), {}),
    [content.modules],
  )
  // The equipment row is replaced whole by whichever editor saved it.
  const handleEquipmentSaved = (equipment) => setContent((current) => ({ ...current, equipment }))

  // The Overview tab is built entirely from data adminListContent() already
  // fetched (content.progress / content.activityLogs) - no extra API calls.
  // Learners are the accounts with no dashboard of their own.
  const traineeCount = useMemo(() => content.users.filter((entry) => !canOpenDashboard(entry)).length, [content.users])
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
        setContentLoading(false)
      })
      .catch((err) => {
        setContentError(err.message)
        setContentLoading(false)
      })
  }, [])

  // The reports and the overview are built server-side from every snapshot,
  // so after a reset they are fetched again rather than patched here.
  const reloadContent = async () => {
    const data = await adminListContent()
    setContent({ ...EMPTY_ADMIN_CONTENT, ...data })
  }

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
      const result = await adminCreateHotspotCategory({ label: newCategory.trim() })
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

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.fullName.trim() || !newUser.password) return
    try {
      const result = await adminCreateUser(newUser)
      setContent((current) => ({ ...current, users: [...current.users, result.user] }))
      setNewUser(EMPTY_NEW_USER)
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

  // Named in the dialog so the wrong row is hard to confirm. The account itself
  // and any skill sign-offs are kept; only the saved progress goes.
  const handleResetProgress = async (learner) => {
    const name = learner.fullName || learner.email
    const confirmed = window.confirm(
      `Reset ${name}'s progress (${learner.email})?\n\n` +
        'Every module step, checklist, quiz attempt and viewed part they have saved is cleared, and they start the training again. Their account is kept. This cannot be undone.',
    )
    if (!confirmed) return
    try {
      await adminResetUserProgress(learner.id)
      await reloadContent()
      refreshMessage(`${name}'s progress was reset.`)
    } catch (err) {
      refreshMessage(err.message)
    }
  }

  return (
    <div className="min-h-svh bg-bg text-left text-ink">
      <div className="sticky top-0 z-20">
        <header className="flex flex-wrap items-start justify-between gap-4.5 border-b border-border bg-panel px-8 py-4">
          <div>
            <p className="m-0 text-[13px] font-semibold text-accent-strong">GearView3D Dashboard</p>
            <h1 className="my-1 text-[22px] font-extrabold text-ink">Content Management</h1>
            <p className="m-0 text-[13px] text-muted">
              Signed in as {user?.email} ({ROLE_LABELS[user?.role] || user?.role})
            </p>
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
          {trainingContentHome && (
            <button className={NAV_TAB_CLASSES(isTrainingContentSection)} onClick={() => onNavigate(trainingContentHome)}>
              <Truck size={16} />
              Training Content
            </button>
          )}
          {allowedTrailingTabs.map(([tabPath, label, Icon]) => (
            <button key={tabPath} className={NAV_TAB_CLASSES(activePath === tabPath)} onClick={() => onNavigate(tabPath)}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {isTrainingContentSection && (
          <nav
            className="flex flex-wrap gap-1 border-b border-border bg-panel px-8 py-1.5 md:pl-[52px]"
            aria-label="Training content sections"
          >
            {allowedContentTabs.map(([tabPath, label, Icon]) => (
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
      ) : !sectionAllowed ? (
        <main className={CONTENT_WRAP}>
          <Panel wide>
            <PanelNote>Your account does not have access to this section.</PanelNote>
            <Toolbar>
              <Button onClick={() => onNavigate(routes.admin)}>Back to the overview</Button>
            </Toolbar>
          </Panel>
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

          {activePath === routes.adminModules && (
            <main className={CONTENT_WRAP}>
              <ModuleListAdmin
                modules={content.modules}
                onModulesChanged={(modules) => setContent((current) => ({ ...current, modules }))}
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
                  equipment={content.equipment}
                  modules={content.modules}
                  checklists={content.checklists}
                  hotspotCategories={content.hotspotCategories}
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

          {activePath === routes.adminParts && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel wide>
                <PanelHeader>Parts Identification</PanelHeader>
                <PanelNote>
                  Click a point on the 3D model to place a part&apos;s marker, or drag an existing marker to move it.
                  Edits are saved as a draft; learners keep the published position and text until you press Publish.
                </PanelNote>
                <HotspotAdmin
                  categories={content.hotspotCategories}
                  surface="parts"
                  onMessage={refreshMessage}
                />
              </Panel>

              <Panel>
                <PanelHeader>Part Categories</PanelHeader>
                <PanelNote>The filter chips above the parts list on the learner page. A category still used by a part cannot be deleted.</PanelNote>
                <div className="mt-3 grid gap-2.5">
                  {content.hotspotCategories.map((category) => (
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
                  scope={PARTS_QUIZ_SCOPE}
                  questions={content.quizQuestions}
                  onQuestionsChanged={(quizQuestions) => setContent((current) => ({ ...current, quizQuestions }))}
                  onMessage={refreshMessage}
                  note="The quiz step of the Parts Identification page. Scores feed the parts percentage."
                />
              </Panel>
            </main>
          )}

          {activePath === routes.adminSettings && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel>
                <PanelHeader>Equipment</PanelHeader>
                <EquipmentCardEditor
                  equipment={content.equipment}
                  onSaved={handleEquipmentSaved}
                  onMessage={refreshMessage}
                />
              </Panel>
              <Panel>
                <PanelHeader>Hub Content</PanelHeader>
                <HubContentEditor
                  equipment={content.equipment}
                  moduleTitles={content.modules.map((module) => module.subtitle || module.title)}
                  hasPartsPage={content.partsHotspotCount > 0}
                  onSaved={handleEquipmentSaved}
                  onMessage={refreshMessage}
                />
              </Panel>
              <Panel wide>
                <PanelHeader>Driving Simulation</PanelHeader>
                <VehicleProfileEditor
                  equipment={content.equipment}
                  onSaved={handleEquipmentSaved}
                  onMessage={refreshMessage}
                />
              </Panel>
            </main>
          )}

          {activePath === routes.adminUsers && (
            <main className={`${CONTENT_WRAP} ${TWO_COL}`}>
              <Panel wide>
                <PanelHeader>Users</PanelHeader>
                {!canManageUsers && (
                  <PanelNote>
                    Trainee accounts. An admin creates accounts and changes names, emails, passwords and roles.
                  </PanelNote>
                )}
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
                      <p className="text-[13px] text-muted">{learner.email} - {ROLE_LABELS[learner.role] || learner.role}</p>
                      <Toolbar>
                        {canManageUsers && (
                          <Button size="sm" variant="secondary" onClick={() => setEditingUser({ ...learner, password: '' })}>Edit</Button>
                        )}
                        {can(user, 'progress.reset') && canActOnRole(user, learner.role) && (
                          <Button size="sm" variant="secondary" onClick={() => handleResetProgress(learner)}>Reset progress</Button>
                        )}
                        {canManageUsers && learner.id !== user.id && (
                          <Button size="sm" variant="danger" onClick={() => handleDeleteUser(learner.id)}>Delete</Button>
                        )}
                      </Toolbar>
                    </article>
                  ))}
                </div>
              </Panel>
              {canManageUsers && (
                <>
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
                          {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
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
                            {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                          </Select>
                        </Field>
                        {editingUser.id === user.id && <PanelNote>You cannot change your own role.</PanelNote>}
                        <Toolbar>
                          <Button onClick={handleSaveUser}>Save user</Button>
                        </Toolbar>
                      </div>
                    ) : <p className="mt-3.5 text-sm text-body">Select a user to edit.</p>}
                  </Panel>
                </>
              )}
            </main>
          )}

          {activePath === routes.adminReports && (
            <main className={CONTENT_WRAP}>
              <ReportsPanel
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
