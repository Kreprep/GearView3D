import { useEffect, useMemo, useState } from 'react'
import { adminCreateCourse, adminListCourses, adminReorderCourses } from '../../lib/api'
import CourseEditor from './CourseEditor'
import './CourseAdmin.css'

const KIND_LABELS = {
  briefing: 'Briefing',
  driving: 'Driving course',
  activity: 'Built-in activity',
  summary: 'Completion summary',
}

// `modules` is the current equipment's course-capable modules, as
// { slug, title } pairs in display order (Walk-Around Check and any other
// hardcoded-page module already filtered out by the caller - see
// AdminDashboard's HARDCODED_PAGE_MODULE_SLUGS). `isForklift` gates the
// Forklift-only editor fields (the summary step's next-route picker).
function CourseAdmin({ modules, isForklift = false, onMessage }) {
  const [courses, setCourses] = useState([])
  const [creatableKinds, setCreatableKinds] = useState(['driving'])
  const [selectedModuleSlug, setSelectedModuleSlug] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState('driving')
  const [loadState, setLoadState] = useState({ loading: true, error: null })

  // Switching equipment sections swaps `modules` for a different equipment's
  // list entirely, so a slug left over from the previous equipment (or the
  // initial null) falls back to that equipment's first module - derived
  // rather than synced via effect, since it is just "clamp to what's valid".
  const moduleSlug = modules.some((module) => module.slug === selectedModuleSlug)
    ? selectedModuleSlug
    : modules[0]?.slug || null

  useEffect(() => {
    let cancelled = false

    adminListCourses()
      .then((data) => {
        if (cancelled) return
        setCourses(data.courses)
        setCreatableKinds(data.creatableKinds || ['driving'])
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const moduleCourses = useMemo(
    () => courses.filter((course) => course.moduleSlug === moduleSlug).sort((a, b) => a.sortOrder - b.sortOrder),
    [courses, moduleSlug],
  )
  const selected = courses.find((course) => course.id === selectedId) || null

  const replaceCourse = (course) => {
    setCourses((current) => current.map((entry) => (entry.id === course.id ? course : entry)))
  }

  const handleDeleted = (courseId) => {
    setCourses((current) => current.filter((entry) => entry.id !== courseId))
    setSelectedId(null)
  }

  const createCourse = async () => {
    if (!newTitle.trim()) return
    try {
      const result = await adminCreateCourse({ moduleSlug, title: newTitle.trim(), kind: newKind })
      setCourses((current) => [...current, result.course])
      setSelectedId(result.course.id)
      setNewTitle('')
      onMessage('Step created. Fill it in, then Publish to show it to learners.')
    } catch (err) {
      onMessage(err.message)
    }
  }

  const moveCourse = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= moduleCourses.length) return

    const reordered = [...moduleCourses]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    try {
      const result = await adminReorderCourses(moduleSlug, reordered.map((course) => course.id))
      setCourses((current) => [
        ...current.filter((course) => course.moduleSlug !== moduleSlug),
        ...result.courses,
      ])
    } catch (err) {
      onMessage(err.message)
    }
  }

  if (loadState.loading) return <p className="admin-panel-note">Loading courses...</p>
  if (loadState.error) return <p className="admin-panel-note">Courses could not be loaded: {loadState.error}</p>
  if (!modules.length) return <p className="admin-panel-note">This equipment has no course-capable modules yet.</p>

  const activeModuleTitle = modules.find((module) => module.slug === moduleSlug)?.title || moduleSlug

  return (
    <div className="course-admin">
      <nav className="course-module-tabs">
        {modules.map(({ slug, title }) => (
          <button
            key={slug}
            type="button"
            className={slug === moduleSlug ? 'is-active' : ''}
            onClick={() => {
              setSelectedModuleSlug(slug)
              setSelectedId(null)
            }}
          >
            {title}
          </button>
        ))}
      </nav>

      <div className="course-admin-body">
        <section className="admin-panel course-list-panel">
          <h2>Steps</h2>
          <p className="admin-panel-note">
            Every step of {activeModuleTitle}, in the order learners see it. Built-in activities keep their
            hardcoded screens but can still be reordered or removed.
          </p>

          <ol className="course-list">
            {moduleCourses.map((course, index) => (
              <li key={course.id} className={course.id === selectedId ? 'is-selected' : ''}>
                <button type="button" className="course-list-name" onClick={() => setSelectedId(course.id)}>
                  <strong>{course.title}</strong>
                  <small>
                    {KIND_LABELS[course.kind] || course.kind}
                    {course.draft && ' - draft'}
                    {!course.published && ' - unpublished'}
                    {!course.builtIn && ' - custom'}
                  </small>
                </button>
                <span className="course-list-actions">
                  <button type="button" onClick={() => moveCourse(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" onClick={() => moveCourse(index, 1)} disabled={index === moduleCourses.length - 1}>Down</button>
                </span>
              </li>
            ))}
          </ol>

          {moduleCourses.length === 0 && <p>No steps in this module yet.</p>}

          <div className="course-create">
            <label>
              New step title
              <input
                value={newTitle}
                placeholder="Narrow Aisle Turn"
                onChange={(event) => setNewTitle(event.target.value)}
              />
            </label>
            <label>
              Step type
              <select value={newKind} onChange={(event) => setNewKind(event.target.value)}>
                {creatableKinds.map((value) => (
                  <option key={value} value={value}>{KIND_LABELS[value] || value}</option>
                ))}
              </select>
            </label>
            <button type="button" className="admin-save" onClick={createCourse} disabled={!newTitle.trim()}>
              Add step
            </button>
          </div>
        </section>

        <section className="course-editor-panel">
          {selected ? (
            <CourseEditor
              key={selected.id}
              course={selected}
              isForklift={isForklift}
              onCourseChanged={replaceCourse}
              onCourseDeleted={handleDeleted}
              onMessage={onMessage}
            />
          ) : (
            <p className="admin-panel-note">Select a driving step to edit its map, or add a new one.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default CourseAdmin
