import { useEffect, useMemo, useState } from 'react'
import { adminCreateCourse, adminListCourses, adminReorderCourses, adminUpdateModule } from '../../lib/api'
import ChecklistAdmin from './ChecklistAdmin'
import CourseEditor from './CourseEditor'
import HotspotAdmin from './HotspotAdmin'
import QuizAdmin from './QuizAdmin'
import './CourseAdmin.css'

// Learner-facing names for the step kinds. The DB values stay as they are;
// these are what an admin picks from.
const KIND_LABELS = {
  briefing: 'Read Up',
  driving: 'Driving Course',
  'walk-around': 'Walk Around',
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
  equipmentId,
  modelUrl,
  modelScale,
  modelOffsetY,
  equipmentModules,
  checklists,
  hotspotCategories,
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

    adminListCourses(module.slug)
      .then((data) => {
        if (cancelled) return
        setCourses(data.courses)
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
      return (
        <div className="admin-panel module-step-empty">
          <h3>No step selected</h3>
          <p className="admin-panel-note">
            Pick a step on the left to edit it, or add one at the bottom of the list. A step&apos;s panel changes
            with its type - a driving course gets the 3D map, a walk-around its inspection checks, a quiz its
            questions.
          </p>
        </div>
      )
    }

    // Checklist, quiz and walk-around steps render rows that belong to the
    // module or the equipment, so their panel is the step's own editor plus
    // those rows.
    const stepEditor = () => (
      <CourseEditor
        key={selected.id}
        course={selected}
        equipmentModules={equipmentModules}
        onCourseChanged={(course) => setCourses((current) => current.map((entry) => (entry.id === course.id ? course : entry)))}
        onCourseDeleted={(courseId) => { setCourses((current) => current.filter((entry) => entry.id !== courseId)); setSelectedId(null) }}
        onMessage={onMessage}
      />
    )

    if (selected.kind === 'checklist') {
      return (
        <>
          {stepEditor()}
          <ChecklistAdmin
            moduleId={module.id}
            items={checklists}
            onItemsChanged={onChecklistsChanged}
            onMessage={onMessage}
          />
        </>
      )
    }

    // A walk-around step's markers are the equipment's hotspots, so they are
    // placed here, beside the checks that reference them. It is the same
    // editor Parts Identification uses, scoped to the walk-around surface - a
    // hotspot ticked for both surfaces is one row, edited in either place.
    if (selected.kind === 'walk-around') {
      return (
        <>
          {stepEditor()}
          <section className="admin-panel">
            <h2>Inspection Hotspots</h2>
            <p className="admin-panel-note">
              The markers this step shows on the model - not the checks themselves (that&apos;s the Walk-around
              content panel above). Click the model to place one, or drag a marker to move it; each has its own
              draft and publish. A marker that is also a part shows up under Parts Identification - it is the same
              hotspot, not a copy.
            </p>
            <HotspotAdmin
              key={equipmentId}
              equipmentId={equipmentId}
              modelUrl={modelUrl}
              modelScale={modelScale}
              modelOffsetY={modelOffsetY}
              categories={hotspotCategories}
              surface="walk-around"
              onMessage={onMessage}
            />
          </section>
        </>
      )
    }

    if (selected.kind === 'quiz') {
      return (
        <>
          {stepEditor()}
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

    return stepEditor()
  }

  return (
    <div className="module-editor">
      <header className="module-editor-bar">
        <button type="button" className="module-editor-back" onClick={onBack}>Back to modules</button>
        <div className="module-editor-heading">
          <p className="admin-kicker">Module Editor</p>
          <h2>{module.fullTitle || module.title}</h2>
        </div>
        <span className="module-editor-count">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
      </header>

      <section className="admin-panel module-details-panel">
        <div className="admin-panel-heading">
          <h2>Module Details</h2>
          <button className="admin-save" onClick={saveModule}>Save module</button>
        </div>
        <div className="admin-editor module-details-grid">
          <label>Title<input value={fields.title || ''} onChange={(event) => setFields({ ...fields, title: event.target.value })} /></label>
          <label>Subtitle<input value={fields.subtitle || ''} onChange={(event) => setFields({ ...fields, subtitle: event.target.value })} /></label>
          <label>
            Full title
            <input value={fields.fullTitle || ''} placeholder={fields.title} onChange={(event) => setFields({ ...fields, fullTitle: event.target.value })} />
            <small className="admin-field-note">The long heading on the module page itself. Blank falls back to the title.</small>
          </label>
          <label>Image URL<input value={fields.imageUrl || ''} onChange={(event) => setFields({ ...fields, imageUrl: event.target.value })} /></label>
          <label className="module-details-wide">
            Description
            <textarea rows={3} value={fields.description || ''} onChange={(event) => setFields({ ...fields, description: event.target.value })} />
            <small className="admin-field-note">Shown on the module card in the learner’s module list.</small>
          </label>
        </div>
      </section>

      <div className="module-editor-body">
        <section className="admin-panel module-steps-panel">
          <div className="admin-panel-heading">
            <h2>Steps</h2>
          </div>
          <p className="admin-panel-note">
            Every step of this module, in the order learners see it. Built-in activities keep their hardcoded
            screens but can still be reordered or removed.
          </p>
          {loadState.loading && <p className="admin-panel-note">Loading steps...</p>}
          {loadState.error && <p className="admin-panel-note">Steps could not be loaded: {loadState.error}</p>}

          <ol className="course-list">
            {steps.map((course, index) => (
              <li key={course.id} className={course.id === selectedId ? 'is-selected' : ''}>
                <button type="button" className="course-list-name" onClick={() => setSelectedId(course.id)}>
                  <span className="course-list-index">{index + 1}</span>
                  <span className="course-list-text">
                    <strong>{course.title}</strong>
                    <small>
                      {KIND_LABELS[course.kind] || course.kind}
                      {course.draft && ' - draft'}
                      {!course.published && ' - unpublished'}
                      {!course.builtIn && ' - custom'}
                    </small>
                  </span>
                </button>
                <span className="course-list-actions">
                  <button type="button" title="Move up" onClick={() => moveStep(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" title="Move down" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>Down</button>
                </span>
              </li>
            ))}
          </ol>

          {!loadState.loading && steps.length === 0 && <p className="admin-panel-note">No steps in this module yet.</p>}

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

        <section className="module-step-panel">{renderStepPanel()}</section>
      </div>
    </div>
  )
}

export default ModuleEditor
