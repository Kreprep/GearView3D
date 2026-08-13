import { useEffect, useMemo, useState } from 'react'
import { adminCreateCourse, adminListCourses, adminReorderCourses, adminUpdateModule } from '../../lib/api'
import ChecklistAdmin from './ChecklistAdmin'
import CourseEditor from './CourseEditor'
import QuizAdmin from './QuizAdmin'
import './CourseAdmin.css'

// Learner-facing names for the step kinds. The DB values stay as they are;
// these are what an admin picks from.
const KIND_LABELS = {
  briefing: 'Read Up',
  driving: 'Driving Course',
  checklist: 'Checklist',
  quiz: 'Quiz',
  activity: 'Built-in Activity',
  summary: 'Completion Summary',
}

// Everything one module owns, in one screen: its card fields, its ordered step
// list, and the selected step edited in place. Checklist items and quiz
// questions belong to the *module*, but they are edited inside the step that
// renders them rather than in tabs of their own.
function ModuleEditor({
  module,
  isForklift,
  checklists,
  quizQuestions,
  onModuleChanged,
  onChecklistsChanged,
  onQuizQuestionsChanged,
  onMessage,
  onBack,
}) {
  const [fields, setFields] = useState(module)
  const [courses, setCourses] = useState([])
  const [creatableKinds, setCreatableKinds] = useState(['briefing'])
  const [selectedId, setSelectedId] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState('briefing')
  const [loadState, setLoadState] = useState({ loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    adminListCourses()
      .then((data) => {
        if (cancelled) return
        setCourses(data.courses.filter((course) => course.moduleSlug === module.slug))
        setCreatableKinds(data.creatableKinds || ['briefing'])
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [module.slug])

  const steps = useMemo(() => [...courses].sort((a, b) => a.sortOrder - b.sortOrder), [courses])
  const selected = courses.find((course) => course.id === selectedId) || null

  const saveModule = async () => {
    try {
      const result = await adminUpdateModule(module.id, fields)
      onModuleChanged(result.module)
      onMessage('Module saved.')
    } catch (error) {
      onMessage(error.message)
    }
  }

  const createStep = async () => {
    if (!newTitle.trim()) return
    try {
      const result = await adminCreateCourse({ moduleSlug: module.slug, title: newTitle.trim(), kind: newKind })
      setCourses((current) => [...current, result.course])
      setSelectedId(result.course.id)
      setNewTitle('')
      onMessage('Step created. Fill it in, then Publish to show it to learners.')
    } catch (err) {
      onMessage(err.message)
    }
  }

  const moveStep = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= steps.length) return

    const reordered = [...steps]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    try {
      const result = await adminReorderCourses(module.slug, reordered.map((course) => course.id))
      setCourses(result.courses)
    } catch (err) {
      onMessage(err.message)
    }
  }

  const renderStepPanel = () => {
    if (!selected) {
      return <p className="admin-panel-note">Select a step to edit it, or add a new one.</p>
    }

    // Checklist and quiz steps render the module's own rows, so their panel is
    // those rows plus the step's intro copy (edited in CourseEditor above).
    if (selected.kind === 'checklist') {
      return (
        <>
          <CourseEditor
            key={selected.id}
            course={selected}
            isForklift={isForklift}
            onCourseChanged={(course) => setCourses((current) => current.map((entry) => (entry.id === course.id ? course : entry)))}
            onCourseDeleted={(courseId) => { setCourses((current) => current.filter((entry) => entry.id !== courseId)); setSelectedId(null) }}
            onMessage={onMessage}
          />
          <ChecklistAdmin
            moduleId={module.id}
            items={checklists}
            onItemsChanged={onChecklistsChanged}
            onMessage={onMessage}
          />
        </>
      )
    }

    if (selected.kind === 'quiz') {
      return (
        <>
          <CourseEditor
            key={selected.id}
            course={selected}
            isForklift={isForklift}
            onCourseChanged={(course) => setCourses((current) => current.map((entry) => (entry.id === course.id ? course : entry)))}
            onCourseDeleted={(courseId) => { setCourses((current) => current.filter((entry) => entry.id !== courseId)); setSelectedId(null) }}
            onMessage={onMessage}
          />
          <QuizAdmin
            scope={{ context: 'module', moduleId: module.id }}
            questions={quizQuestions}
            onQuestionsChanged={onQuizQuestionsChanged}
            onMessage={onMessage}
            note="Asked on this step. Ungraded - attempts are recorded but never block Next."
          />
        </>
      )
    }

    return (
      <CourseEditor
        key={selected.id}
        course={selected}
        isForklift={isForklift}
        onCourseChanged={(course) => setCourses((current) => current.map((entry) => (entry.id === course.id ? course : entry)))}
        onCourseDeleted={(courseId) => { setCourses((current) => current.filter((entry) => entry.id !== courseId)); setSelectedId(null) }}
        onMessage={onMessage}
      />
    )
  }

  return (
    <div className="course-admin">
      <div className="module-editor-bar">
        <button type="button" onClick={onBack}>Back to modules</button>
        <h2>{module.fullTitle || module.title}</h2>
      </div>

      <div className="course-admin-body">
        <section className="admin-panel course-list-panel">
          <h2>Module Details</h2>
          <div className="admin-editor module-editor-fields">
            <label>Title<input value={fields.title || ''} onChange={(event) => setFields({ ...fields, title: event.target.value })} /></label>
            <label>Subtitle<input value={fields.subtitle || ''} onChange={(event) => setFields({ ...fields, subtitle: event.target.value })} /></label>
            <label>Description<textarea value={fields.description || ''} onChange={(event) => setFields({ ...fields, description: event.target.value })} /></label>
            <label>Full title<input value={fields.fullTitle || ''} placeholder={fields.title} onChange={(event) => setFields({ ...fields, fullTitle: event.target.value })} /></label>
            <p className="admin-panel-note">The long heading on the module page itself. Blank falls back to the title.</p>
            <label>Image URL<input value={fields.imageUrl || ''} onChange={(event) => setFields({ ...fields, imageUrl: event.target.value })} /></label>
            <button className="admin-save" onClick={saveModule}>Save module</button>
          </div>

          <h2>Steps</h2>
          {loadState.loading && <p className="admin-panel-note">Loading steps...</p>}
          {loadState.error && <p className="admin-panel-note">Steps could not be loaded: {loadState.error}</p>}
          <p className="admin-panel-note">
            Every step of this module, in the order learners see it. Built-in activities keep their hardcoded
            screens but can still be reordered or removed.
          </p>

          <ol className="course-list">
            {steps.map((course, index) => (
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
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>Down</button>
                </span>
              </li>
            ))}
          </ol>

          {!loadState.loading && steps.length === 0 && <p>No steps in this module yet.</p>}

          <div className="course-create">
            <label>
              New step title
              <input value={newTitle} placeholder="Narrow Aisle Turn" onChange={(event) => setNewTitle(event.target.value)} />
            </label>
            <label>
              Step type
              <select value={newKind} onChange={(event) => setNewKind(event.target.value)}>
                {creatableKinds.map((value) => (
                  <option key={value} value={value}>{KIND_LABELS[value] || value}</option>
                ))}
              </select>
            </label>
            <button type="button" className="admin-save" onClick={createStep} disabled={!newTitle.trim()}>
              Add step
            </button>
          </div>
        </section>

        <section className="course-editor-panel">{renderStepPanel()}</section>
      </div>
    </div>
  )
}

export default ModuleEditor
