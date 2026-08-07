import { useEffect, useMemo, useState } from 'react'
import { adminCreateCourse, adminListCourses, adminReorderCourses } from '../../lib/api'
import CourseEditor from './CourseEditor'
import './CourseAdmin.css'

const MODULE_LABELS = {
  'load-handling': 'Module 2 - Load Handling',
  'post-operation': 'Module 3 - Post-Operation',
  'pallet-testing': 'Module 4 - Pallet Assessment',
}

const MODULE_ORDER = ['load-handling', 'post-operation', 'pallet-testing']

function CourseAdmin({ onMessage }) {
  const [courses, setCourses] = useState([])
  const [bespokeSteps, setBespokeSteps] = useState({})
  const [moduleSlug, setModuleSlug] = useState(MODULE_ORDER[0])
  const [selectedId, setSelectedId] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [loadState, setLoadState] = useState({ loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    adminListCourses()
      .then((data) => {
        if (cancelled) return
        setCourses(data.courses)
        setBespokeSteps(data.bespokeSteps)
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
      const result = await adminCreateCourse({ moduleSlug, title: newTitle.trim() })
      setCourses((current) => [...current, result.course])
      setSelectedId(result.course.id)
      setNewTitle('')
      onMessage('Step created. Place its objects, then Publish to show it to learners.')
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

  return (
    <div className="course-admin">
      <nav className="course-module-tabs">
        {MODULE_ORDER.map((slug) => (
          <button
            key={slug}
            type="button"
            className={slug === moduleSlug ? 'is-active' : ''}
            onClick={() => {
              setModuleSlug(slug)
              setSelectedId(null)
            }}
          >
            {MODULE_LABELS[slug]}
          </button>
        ))}
      </nav>

      <div className="course-admin-body">
        <section className="admin-panel course-list-panel">
          <h2>Driving steps</h2>
          <p className="admin-panel-note">
            These are the simulation steps of {MODULE_LABELS[moduleSlug]}. They run between the module's built-in
            steps ({(bespokeSteps[moduleSlug] || []).join(', ')}), which are hardcoded and cannot be edited here.
          </p>

          <ol className="course-list">
            {moduleCourses.map((course, index) => (
              <li key={course.id} className={course.id === selectedId ? 'is-selected' : ''}>
                <button type="button" className="course-list-name" onClick={() => setSelectedId(course.id)}>
                  <strong>{course.title}</strong>
                  <small>
                    {course.id}
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

          {moduleCourses.length === 0 && <p>No driving steps in this module yet.</p>}

          <div className="course-create">
            <label>
              New step title
              <input
                value={newTitle}
                placeholder="Narrow Aisle Turn"
                onChange={(event) => setNewTitle(event.target.value)}
              />
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
