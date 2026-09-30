import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { describeActivity, formatRelativeTime } from '../../lib/adminActivity'
import { can } from '../../data/permissions.js'
import TraineeSkills from './TraineeSkills'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Select } from '../ui/input'

const TIMELINE_PAGE_SIZE = 15

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

function userLabel(user) {
  return user?.fullName || user?.email || 'Unknown user'
}

// Per-user, per-module completion plus a timeline of recent quiz activity. `progress` already carries one entry per module for every
// user who has ever saved a snapshot (see buildAdminProgressReport on the
// backend) - a user with no snapshot at all gets synthesized zero rows here
// so the roster always lists every account, not just ones with activity.
// Expanding a learner also shows their Skills Checklist, with sign-off and
// revoke for whoever holds skills.signoff (never on their own account).
function ReportsPanel({ viewer, modules, users, progress, activityLogs, onMessage }) {
  const [expandedUserIds, setExpandedUserIds] = useState(() => new Set())
  const [userFilter, setUserFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE_SIZE)

  const moduleTitleBySlug = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.slug, module.title || module.fullTitle])),
    [modules],
  )
  const orderedModules = useMemo(() => [...modules].sort((a, b) => a.sortOrder - b.sortOrder), [modules])

  const progressByUserId = useMemo(() => {
    const map = new Map()
    for (const entry of progress) {
      const list = map.get(entry.user.id) || []
      list.push(entry)
      map.set(entry.user.id, list)
    }
    return map
  }, [progress])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => userLabel(a).localeCompare(userLabel(b))),
    [users],
  )

  const toggleUser = (userId) => {
    setExpandedUserIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // One row per module for one user, in module order, falling back to a zero
  // row for a module the user's snapshot (if any) has no entry for.
  const buildUserRows = (userId) => {
    const entriesBySlug = Object.fromEntries(
      (progressByUserId.get(userId) || []).map((entry) => [entry.moduleSlug, entry]),
    )

    return orderedModules.map((module) => entriesBySlug[module.slug] || {
      moduleSlug: module.slug,
      progress: 0,
      updatedAt: null,
    })
  }

  const filteredActivity = useMemo(() => {
    return activityLogs.filter((entry) => {
      if (userFilter !== 'all' && entry.user?.id !== userFilter) return false
      if (moduleFilter !== 'all' && entry.moduleSlug !== moduleFilter) return false
      return true
    })
  }, [activityLogs, userFilter, moduleFilter])

  // Walks the same per-user rows the roster renders (including the zero rows
  // synthesized for a user with no snapshot yet), so the export always covers
  // every user and every module rather than only users who have saved
  // progress at least once.
  const exportCsv = () => {
    const rows = sortedUsers.flatMap((user) =>
      buildUserRows(user.id).map((row) => [
        user.email,
        moduleTitleBySlug[row.moduleSlug] || row.moduleSlug,
        row.progress,
        row.updatedAt || '',
      ]),
    )

    downloadCsv('gearview3d-progress-report.csv', [
      ['Learner', 'Module', 'Progress', 'Last Activity'],
      ...rows,
    ])
  }

  return (
    <>
      <Panel wide>
        <PanelHeader actions={<Button onClick={exportCsv}>Export CSV</Button>}>Progress Reports</PanelHeader>
        {sortedUsers.length === 0 && <PanelNote>No users yet.</PanelNote>}
        <div className="grid gap-2.5">
          {sortedUsers.map((user) => {
            const isExpanded = expandedUserIds.has(user.id)
            const userEntries = progressByUserId.get(user.id) || []
            const average = userEntries.length
              ? Math.round(userEntries.reduce((sum, entry) => sum + entry.progress, 0) / userEntries.length)
              : 0

            return (
              <article key={user.id} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 bg-slate-50 px-3.5 py-3 text-left text-ink hover:bg-slate-100"
                  onClick={() => toggleUser(user.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="text-sm font-bold">{userLabel(user)}</span>
                  <span className="text-[12.5px] text-muted">{user.email}</span>
                  <span className="ml-auto text-[13px] font-bold text-accent-strong">{average}% avg</span>
                </button>

                {isExpanded && (
                  <div className="grid gap-2 border-t border-slate-200 p-3.5">
                    {userEntries.length === 0 && <PanelNote>No progress recorded yet.</PanelNote>}
                    {orderedModules.length === 0 && <PanelNote>No training content published yet.</PanelNote>}
                    {orderedModules.length > 0 && (
                      <div className="grid gap-0.5">
                        {buildUserRows(user.id).map((row) => (
                          <div
                            key={row.moduleSlug}
                            className="grid grid-cols-[minmax(160px,260px)_1fr_44px_90px] items-center gap-3 border-t border-slate-100 py-1.5 first:border-t-0 max-[980px]:grid-cols-1 max-[980px]:gap-1"
                          >
                            <span className="text-[13px] font-bold text-body">{moduleTitleBySlug[row.moduleSlug] || row.moduleSlug}</span>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-accent-strong" style={{ width: `${row.progress}%` }} />
                            </div>
                            <span className="text-right text-[13px] font-bold text-muted max-[980px]:text-left">{row.progress}%</span>
                            <span className="text-right text-xs font-semibold text-muted max-[980px]:text-left">
                              {row.updatedAt
                                ? <time dateTime={row.updatedAt} title={new Date(row.updatedAt).toLocaleString()}>{formatRelativeTime(row.updatedAt)}</time>
                                : <span className="italic">No activity yet</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 border-t border-slate-200 pt-3">
                      <h3 className="m-0 text-sm font-extrabold text-ink">Skills checklist</h3>
                      <TraineeSkills
                        learner={user}
                        canSignOff={can(viewer, 'skills.signoff') && user.id !== viewer?.id}
                        onMessage={onMessage}
                      />
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </Panel>

      <Panel wide>
        <PanelHeader>Recent activity</PanelHeader>
        <div className="mb-3.5 flex flex-wrap gap-2.5">
          <Select style={{ width: 'auto' }} value={userFilter} onChange={(event) => { setUserFilter(event.target.value); setTimelineLimit(TIMELINE_PAGE_SIZE) }}>
            <option value="all">All learners</option>
            {sortedUsers.map((user) => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}
          </Select>
          <Select style={{ width: 'auto' }} value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setTimelineLimit(TIMELINE_PAGE_SIZE) }}>
            <option value="all">All modules</option>
            {orderedModules.map((module) => <option key={module.slug} value={module.slug}>{module.title || module.fullTitle}</option>)}
          </Select>
        </div>

        {filteredActivity.length === 0 && <PanelNote>No learner activity recorded yet.</PanelNote>}
        <ul className="m-0 grid gap-0.5 p-0">
          {filteredActivity.slice(0, timelineLimit).map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-4 border-t border-slate-200 py-2.5 text-[13.5px] text-body first:border-t-0">
              <span>{describeActivity(entry, moduleTitleBySlug[entry.moduleSlug])}</span>
              <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()} className="flex-none text-xs font-semibold text-muted">
                {formatRelativeTime(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
        {filteredActivity.length > timelineLimit && (
          <Button type="button" variant="secondary" className="mt-2.5" onClick={() => setTimelineLimit((current) => current + TIMELINE_PAGE_SIZE)}>
            Load more
          </Button>
        )}
      </Panel>
    </>
  )
}

export default ReportsPanel
