import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { describeActivity, formatRelativeTime } from '../../lib/adminActivity'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Select } from '../ui/input'
import { Badge } from '../ui/badge'

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

// Per-user, per-equipment, per-module completion plus a timeline of recent
// quiz activity. `progress` already carries one entry per module for every
// user who has ever saved a snapshot (see buildAdminProgressReport on the
// backend) - a user with no snapshot at all gets synthesized zero rows here
// so the roster always lists every account, not just ones with activity.
function ReportsPanel({ equipment, modules, users, progress, activityLogs }) {
  const [expandedUserIds, setExpandedUserIds] = useState(() => new Set())
  const [expandedEquipmentKeys, setExpandedEquipmentKeys] = useState(() => new Set())
  const [userFilter, setUserFilter] = useState('all')
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE_SIZE)

  const equipmentById = useMemo(() => Object.fromEntries(equipment.map((item) => [item.id, item])), [equipment])
  const moduleTitleBySlug = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.slug, module.title || module.fullTitle])),
    [modules],
  )
  // The equipment sections every user's dropdown shows, in catalog order -
  // only ones that actually have a module, since an empty section has
  // nothing to report against.
  const reportedEquipment = useMemo(
    () => equipment.filter((item) => modules.some((module) => module.equipmentId === item.id)),
    [equipment, modules],
  )

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

  const toggleEquipment = (equipmentKey) => {
    setExpandedEquipmentKeys((current) => {
      const next = new Set(current)
      if (next.has(equipmentKey)) next.delete(equipmentKey)
      else next.add(equipmentKey)
      return next
    })
  }

  // Builds { equipmentId -> [module rows] } for one user, falling back to a
  // zero row for a module the user's snapshot (if any) has no entry for.
  const buildUserSections = (userId) => {
    const entriesBySlug = Object.fromEntries(
      (progressByUserId.get(userId) || []).map((entry) => [entry.moduleSlug, entry]),
    )

    const sections = new Map()
    for (const item of reportedEquipment) {
      const equipmentModules = modules
        .filter((module) => module.equipmentId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((module) => entriesBySlug[module.slug] || {
          moduleSlug: module.slug,
          equipmentId: module.equipmentId,
          progress: 0,
          updatedAt: null,
        })
      sections.set(item.id, equipmentModules)
    }
    return sections
  }

  const filteredActivity = useMemo(() => {
    return activityLogs.filter((entry) => {
      if (userFilter !== 'all' && entry.user?.id !== userFilter) return false
      if (equipmentFilter !== 'all' && entry.equipmentId !== equipmentFilter) return false
      if (moduleFilter !== 'all' && entry.moduleSlug !== moduleFilter) return false
      return true
    })
  }, [activityLogs, userFilter, equipmentFilter, moduleFilter])

  const moduleFilterOptions = useMemo(
    () => modules
      .filter((module) => equipmentFilter === 'all' || module.equipmentId === equipmentFilter)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [modules, equipmentFilter],
  )

  // Walks the same per-user sections the roster renders (including the zero
  // rows synthesized for a user with no snapshot yet), so the export always
  // covers every user and every module rather than only users who have saved
  // progress at least once.
  const exportCsv = () => {
    const rows = sortedUsers.flatMap((user) => {
      const sections = buildUserSections(user.id)
      return [...sections.entries()].flatMap(([equipmentId, moduleRows]) =>
        moduleRows.map((row) => [
          user.email,
          equipmentById[equipmentId]?.title || equipmentId,
          moduleTitleBySlug[row.moduleSlug] || row.moduleSlug,
          row.progress,
          row.updatedAt || '',
        ]),
      )
    })

    downloadCsv('gearview3d-progress-report.csv', [
      ['Learner', 'Equipment', 'Module', 'Progress', 'Last Activity'],
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
                    {reportedEquipment.length === 0 && <PanelNote>No training content published yet.</PanelNote>}
                    {[...buildUserSections(user.id).entries()].map(([equipmentId, rows]) => {
                      const item = equipmentById[equipmentId]
                      const equipmentKey = `${user.id}:${equipmentId}`
                      const isEquipmentExpanded = expandedEquipmentKeys.has(equipmentKey)
                      const equipmentAverage = rows.length
                        ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length)
                        : 0

                      return (
                        <div key={equipmentId} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-bold hover:bg-slate-100 ${
                              item?.available ? 'text-body' : 'text-muted'
                            }`}
                            onClick={() => toggleEquipment(equipmentKey)}
                            aria-expanded={isEquipmentExpanded}
                          >
                            {isEquipmentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {item?.title || equipmentId}
                            {!item?.available && <Badge>Not available for training</Badge>}
                            <span className="ml-auto text-xs font-bold text-accent-strong">{equipmentAverage}% avg</span>
                          </button>
                          {isEquipmentExpanded && (
                            <div className="grid gap-0.5 border-t border-slate-200 px-3 pb-2.5 pt-1.5">
                              {rows.map((row) => (
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
                        </div>
                      )
                    })}
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
          <Select
            style={{ width: 'auto' }}
            value={equipmentFilter}
            onChange={(event) => {
              setEquipmentFilter(event.target.value)
              setModuleFilter('all')
              setTimelineLimit(TIMELINE_PAGE_SIZE)
            }}
          >
            <option value="all">All equipment</option>
            {reportedEquipment.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </Select>
          <Select style={{ width: 'auto' }} value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setTimelineLimit(TIMELINE_PAGE_SIZE) }}>
            <option value="all">All modules</option>
            {moduleFilterOptions.map((module) => <option key={module.slug} value={module.slug}>{module.title || module.fullTitle}</option>)}
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
