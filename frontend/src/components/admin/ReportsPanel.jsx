import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { describeActivity, formatRelativeTime } from '../../lib/adminActivity'

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
      <section className="admin-panel wide-panel">
        <div className="admin-panel-heading reports-panel-heading">
          <h2>Progress Reports</h2>
          <button className="admin-save" onClick={exportCsv}>Export CSV</button>
        </div>
        {sortedUsers.length === 0 && <p className="admin-panel-note">No users yet.</p>}
        <div className="reports-user-list">
          {sortedUsers.map((user) => {
            const isExpanded = expandedUserIds.has(user.id)
            const userEntries = progressByUserId.get(user.id) || []
            const average = userEntries.length
              ? Math.round(userEntries.reduce((sum, entry) => sum + entry.progress, 0) / userEntries.length)
              : 0

            return (
              <article key={user.id} className="reports-user-row">
                <button
                  type="button"
                  className="reports-user-header"
                  onClick={() => toggleUser(user.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="reports-user-name">{userLabel(user)}</span>
                  <span className="reports-user-email">{user.email}</span>
                  <span className="reports-user-average">{average}% avg</span>
                </button>

                {isExpanded && (
                  <div className="reports-user-body">
                    {userEntries.length === 0 && (
                      <p className="admin-panel-note">No progress recorded yet.</p>
                    )}
                    {reportedEquipment.length === 0 && (
                      <p className="admin-panel-note">No training content published yet.</p>
                    )}
                    {[...buildUserSections(user.id).entries()].map(([equipmentId, rows]) => {
                      const item = equipmentById[equipmentId]
                      const equipmentKey = `${user.id}:${equipmentId}`
                      const isEquipmentExpanded = expandedEquipmentKeys.has(equipmentKey)
                      const equipmentAverage = rows.length
                        ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length)
                        : 0

                      return (
                        <div key={equipmentId} className="reports-equipment-group">
                          <button
                            type="button"
                            className={`reports-equipment-title${item?.available ? '' : ' is-unavailable'}`}
                            onClick={() => toggleEquipment(equipmentKey)}
                            aria-expanded={isEquipmentExpanded}
                          >
                            {isEquipmentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {item?.title || equipmentId}
                            {!item?.available && <span className="reports-unavailable-tag">Not available for training</span>}
                            <span className="reports-equipment-average">{equipmentAverage}% avg</span>
                          </button>
                          {isEquipmentExpanded && (
                            <div className="overview-meter-list">
                              {rows.map((row) => (
                                <div key={row.moduleSlug} className="reports-module-row">
                                  <span className="overview-meter-label">{moduleTitleBySlug[row.moduleSlug] || row.moduleSlug}</span>
                                  <div className="overview-meter-track">
                                    <div className="overview-meter-fill" style={{ width: `${row.progress}%` }} />
                                  </div>
                                  <span className="overview-meter-value">{row.progress}%</span>
                                  <span className="reports-module-timestamp">
                                    {row.updatedAt
                                      ? <time dateTime={row.updatedAt} title={new Date(row.updatedAt).toLocaleString()}>{formatRelativeTime(row.updatedAt)}</time>
                                      : <span className="reports-module-timestamp-empty">No activity yet</span>}
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
      </section>

      <section className="admin-panel wide-panel">
        <h2>Recent activity</h2>
        <div className="reports-filters">
          <select value={userFilter} onChange={(event) => { setUserFilter(event.target.value); setTimelineLimit(TIMELINE_PAGE_SIZE) }}>
            <option value="all">All learners</option>
            {sortedUsers.map((user) => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}
          </select>
          <select
            value={equipmentFilter}
            onChange={(event) => {
              setEquipmentFilter(event.target.value)
              setModuleFilter('all')
              setTimelineLimit(TIMELINE_PAGE_SIZE)
            }}
          >
            <option value="all">All equipment</option>
            {reportedEquipment.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setTimelineLimit(TIMELINE_PAGE_SIZE) }}>
            <option value="all">All modules</option>
            {moduleFilterOptions.map((module) => <option key={module.slug} value={module.slug}>{module.title || module.fullTitle}</option>)}
          </select>
        </div>

        {filteredActivity.length === 0 && <p className="admin-panel-note">No learner activity recorded yet.</p>}
        <ul className="overview-activity-list">
          {filteredActivity.slice(0, timelineLimit).map((entry) => (
            <li key={entry.id}>
              <span>{describeActivity(entry, moduleTitleBySlug[entry.moduleSlug])}</span>
              <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()}>{formatRelativeTime(entry.createdAt)}</time>
            </li>
          ))}
        </ul>
        {filteredActivity.length > timelineLimit && (
          <button className="admin-btn" onClick={() => setTimelineLimit((current) => current + TIMELINE_PAGE_SIZE)}>
            Load more
          </button>
        )}
      </section>
    </>
  )
}

export default ReportsPanel
