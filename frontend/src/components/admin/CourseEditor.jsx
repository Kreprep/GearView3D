import { useCallback, useEffect, useMemo, useState } from 'react'
import DrivingSimulationViewer from '../DrivingSimulationViewer'
import {
  adminDeleteCourse,
  adminPublishCourse,
  adminResetCourse,
  adminRevertCourse,
  adminSaveCourseDraft,
} from '../../lib/api'
import {
  addItem,
  appendDecorations,
  courseBounds,
  getItem,
  listCourseItems,
  moveItem,
  OBJECT_LABELS,
  PLACEABLE_KINDS,
  removeItems,
  updateItem,
} from '../../lib/courseEdit'
import { COURSE_GOAL_TYPES, validateCourse } from '../../lib/courseGoals'
import CourseCanvas from './CourseCanvas'
import CourseGeneratorTools from './CourseGeneratorTools'
import CourseInspector from './CourseInspector'
import './CourseEditor.css'

const GOAL_LABELS = {
  checkpoints: 'Checkpoint run',
  parking: 'Park in bay',
  pallet: 'Pallet delivery',
  free: 'Free practice',
}

const GOAL_HINTS = {
  checkpoints: 'Completes when every checkpoint has been cleared in list order.',
  parking: 'Completes when the forklift is inside the bay, aligned, stopped, forks lowered and the engine off.',
  pallet: 'Completes when a pallet is lifted and set down inside the drop zone.',
  free: 'No goal - the step is completed by the module page (for example pressing every control key).',
}

const SNAP_OPTIONS = [
  [0.1, '0.1'],
  [0.5, '0.5'],
  [0, 'Off'],
]

function draftOf(course) {
  const source = course.draft || course
  return {
    title: source.title,
    objective: source.objective || '',
    instructions: source.instructions || '',
    hint: source.hint || '',
    goalType: source.goalType || 'checkpoints',
    data: source.data || source.course,
  }
}

function CourseEditor({ course, onCourseChanged, onCourseDeleted, onMessage }) {
  const [draft, setDraft] = useState(() => draftOf(course))
  const [selectedKeys, setSelectedKeys] = useState([])
  const [tool, setTool] = useState(null)
  const [snap, setSnap] = useState(0.1)
  const [pxPerUnit, setPxPerUnit] = useState(24)
  const [bounds, setBounds] = useState(() => courseBounds(draftOf(course).data))
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSeed, setPreviewSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [undoStack, setUndoStack] = useState([])

  // Local edits stay authoritative while the admin works - saving must not
  // wipe their selection - so props are only pulled back in after an action
  // that replaces the content server-side (reset / discard draft). Switching
  // to a different step remounts the editor via its key in CourseAdmin.
  const resyncFrom = (nextCourse) => {
    const next = draftOf(nextCourse)
    setDraft(next)
    setBounds(courseBounds(next.data))
    setSelectedKeys([])
    setTool(null)
    setDirty(false)
    setUndoStack([])
  }

  const data = draft.data
  const problems = useMemo(
    () => validateCourse({ ...data, goalType: draft.goalType }),
    [data, draft.goalType],
  )

  // A drag pushes one undo entry at the start, not one per pointer move.
  const pushUndo = useCallback(() => {
    setUndoStack((stack) => [...stack.slice(-49), draft.data])
  }, [draft.data])

  const applyData = useCallback((nextData) => {
    setDraft((current) => ({ ...current, data: nextData }))
    setDirty(true)
  }, [])

  const commitData = useCallback(
    (nextData) => {
      pushUndo()
      applyData(nextData)
    },
    [applyData, pushUndo],
  )

  const mutate = useCallback(
    (fn) => commitData(fn(draft.data)),
    [commitData, draft.data],
  )

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      const previous = stack[stack.length - 1]
      if (!previous) return stack
      applyData(previous)
      setSelectedKeys([])
      return stack.slice(0, -1)
    })
  }, [applyData])

  const deleteSelected = useCallback(() => {
    if (!selectedKeys.length) return
    mutate((current) => removeItems(current, selectedKeys))
    setSelectedKeys([])
  }, [mutate, selectedKeys])

  // Keyboard shortcuts are ignored while a form field has focus, so typing a
  // label never deletes the object being labelled.
  useEffect(() => {
    const handler = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (event.key === 'Escape') {
        setTool(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, undo])

  const selectItem = (key, additive) => {
    if (!key) return setSelectedKeys([])
    setSelectedKeys((current) => {
      if (!additive) return [key]
      return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    })
  }

  const placeItem = (kind, x, z) => {
    mutate((current) => addItem(current, kind, x, z))
    setTool(null)
  }

  const selectedItem = selectedKeys.length === 1 ? getItem(data, selectedKeys[0]) : null
  const checkpoints = data.checkpoints || []

  const moveCheckpoint = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= checkpoints.length) return
    const reordered = [...checkpoints]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)
    mutate((current) => ({ ...current, checkpoints: reordered }))
    setSelectedKeys([`checkpoints:${target}`])
  }

  const setField = (patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const setCourseValue = (patch) => commitData({ ...data, ...patch })

  const run = async (action, successMessage, { resync = false } = {}) => {
    setBusy(true)
    try {
      const result = await action()
      if (result?.course) {
        onCourseChanged(result.course)
        setDirty(false)
        if (resync) resyncFrom(result.course)
      }
      onMessage(successMessage)
      return result
    } catch (err) {
      onMessage(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => run(() => adminSaveCourseDraft(course.id, draft), 'Draft saved.')

  const publish = async () => {
    const saved = await run(() => adminSaveCourseDraft(course.id, draft), 'Draft saved.')
    if (!saved) return
    await run(() => adminPublishCourse(course.id), 'Course published - learners see it now.')
  }

  const revert = () => {
    if (!window.confirm('Discard the unpublished draft and go back to the published version?')) return
    return run(() => adminRevertCourse(course.id), 'Draft discarded.', { resync: true })
  }

  const reset = () => {
    if (!window.confirm('Reset this course to its built-in default? Current geometry and text are replaced.')) return
    return run(() => adminResetCourse(course.id), 'Course reset to default.', { resync: true })
  }

  const remove = async () => {
    if (!window.confirm(`Delete the step "${draft.title}"? Learners will no longer see it.`)) return
    setBusy(true)
    try {
      await adminDeleteCourse(course.id)
      onCourseDeleted(course.id)
      onMessage('Course deleted.')
    } catch (err) {
      onMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const previewCourse = useMemo(
    () => ({ id: `${course.id}-preview-${previewSeed}`, goalType: draft.goalType, ...data }),
    [course.id, data, draft.goalType, previewSeed],
  )

  const itemCounts = useMemo(() => {
    const counts = {}
    for (const item of listCourseItems(data)) {
      counts[item.kind] = (counts[item.kind] || 0) + 1
    }
    return counts
  }, [data])

  return (
    <div className="course-editor">
      <header className="course-editor-bar">
        <div>
          <h2>{draft.title}</h2>
          <p className="course-editor-id">
            {course.id} - {course.moduleSlug}
            {course.draft && <span className="course-badge draft">Unpublished draft</span>}
            {!course.published && <span className="course-badge unpublished">Not visible to learners</span>}
            {dirty && <span className="course-badge dirty">Unsaved changes</span>}
          </p>
        </div>
        <div className="course-editor-actions">
          <button type="button" onClick={saveDraft} disabled={busy}>Save draft</button>
          <button type="button" className="admin-save" onClick={publish} disabled={busy}>Publish</button>
          {course.draft && <button type="button" onClick={revert} disabled={busy}>Discard draft</button>}
          {course.builtIn && <button type="button" onClick={reset} disabled={busy}>Reset to default</button>}
          <button type="button" className="course-danger" onClick={remove} disabled={busy}>Delete step</button>
        </div>
      </header>

      {problems.length > 0 && (
        <div className="course-problems">
          <strong>Cannot publish yet:</strong>
          <ul>
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      )}

      <div className="course-editor-body">
        <section className="course-editor-map">
          <div className="course-toolbar">
            <span className="course-toolbar-label">Place</span>
            {PLACEABLE_KINDS.filter((kind) => !(kind === 'dropZone' && data.dropZone) && !(kind === 'parkingBay' && data.parkingBay)).map((kind) => (
              <button
                key={kind}
                type="button"
                className={tool === kind ? 'is-active' : ''}
                onClick={() => setTool(tool === kind ? null : kind)}
              >
                {OBJECT_LABELS[kind]}
              </button>
            ))}
            <span className="course-toolbar-spacer" />
            <label className="course-toolbar-field">
              Snap
              <select value={snap} onChange={(event) => setSnap(Number(event.target.value))}>
                {SNAP_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setPxPerUnit((value) => Math.max(8, value - 6))}>-</button>
            <button type="button" onClick={() => setPxPerUnit((value) => Math.min(80, value + 6))}>+</button>
            <button type="button" onClick={() => setBounds(courseBounds(data))}>Fit view</button>
            <button type="button" onClick={undo} disabled={!undoStack.length}>Undo</button>
          </div>

          <p className="admin-panel-note">
            Seen from the driver's seat: forward (+Z) is up the map and the forklift's right is the right of the map.
            Drag to move, Shift-click to multi-select, Delete to remove.
          </p>

          <CourseCanvas
            data={data}
            bounds={bounds}
            pxPerUnit={pxPerUnit}
            snap={snap}
            tool={tool}
            selectedKeys={selectedKeys}
            onSelect={selectItem}
            onMoveStart={pushUndo}
            onMove={(key, x, z) => applyData(moveItem(data, key, x, z))}
            onMoveEnd={() => {}}
            onPlace={placeItem}
          />

          <p className="course-counts">
            {Object.entries(itemCounts).map(([kind, count]) => `${OBJECT_LABELS[kind] || kind}: ${count}`).join('  |  ')}
          </p>

          {/* The preview is the same heavy Three.js scene the learner drives, so
              it is only mounted on request - otherwise every course selection
              would spin up a WebGL context alongside the map. */}
          <div className="course-preview">
            <button type="button" onClick={() => setShowPreview((value) => !value)}>
              {showPreview ? 'Hide 3D preview' : 'Show 3D preview'}
            </button>
            {showPreview && (
              <>
                <button type="button" onClick={() => setPreviewSeed((seed) => seed + 1)}>Reload preview</button>
                <div className="course-preview-stage">
                  <DrivingSimulationViewer course={previewCourse} isAdmin />
                </div>
                <p className="admin-panel-note">
                  The preview uses the unsaved draft. Reload it after moving objects to drive the new layout.
                </p>
              </>
            )}
          </div>
        </section>

        <aside className="course-editor-side">
          <section className="admin-panel">
            <h3>Step text</h3>
            <label>Title<input value={draft.title} onChange={(event) => setField({ title: event.target.value })} /></label>
            <label>Objective<textarea rows={2} value={draft.objective} onChange={(event) => setField({ objective: event.target.value })} /></label>
            <label>Instructions<textarea rows={3} value={draft.instructions} onChange={(event) => setField({ instructions: event.target.value })} /></label>
            <label>Hint<textarea rows={2} value={draft.hint} onChange={(event) => setField({ hint: event.target.value })} /></label>
          </section>

          <section className="admin-panel">
            <h3>Goal</h3>
            <label>
              Completion rule
              <select value={draft.goalType} onChange={(event) => setField({ goalType: event.target.value })}>
                {COURSE_GOAL_TYPES.map((value) => <option key={value} value={value}>{GOAL_LABELS[value]}</option>)}
              </select>
            </label>
            <p className="admin-panel-note">{GOAL_HINTS[draft.goalType]}</p>

            <label>
              Rated capacity (kg, blank for no limit)
              <input
                type="number"
                step={50}
                value={data.capacityKg ?? ''}
                onChange={(event) => setCourseValue({ capacityKg: event.target.value === '' ? null : Number(event.target.value) })}
              />
            </label>
            <label className="course-checkbox">
              <input
                type="checkbox"
                checked={Boolean(data.failConditions?.overload)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, overload: event.target.checked } })}
              />
              Fail on lifting over capacity
            </label>
            <label className="course-checkbox">
              <input
                type="checkbox"
                checked={Boolean(data.failConditions?.suddenStop)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, suddenStop: event.target.checked } })}
              />
              Fail on braking hard while carrying
            </label>
            <p className="admin-panel-note">Cones, walls and parked forklifts are always live colliders - striking one always fails the attempt.</p>
          </section>

          <section className="admin-panel">
            <h3>Selected object</h3>
            <CourseInspector
              item={selectedItem}
              onChange={(patch) => commitData(updateItem(data, selectedItem.key, patch))}
              onMove={(x, z) => commitData(moveItem(data, selectedItem.key, x, z))}
              onDelete={deleteSelected}
            />
            {selectedKeys.length > 1 && (
              <p className="admin-panel-note">{selectedKeys.length} objects selected. Delete removes all of them.</p>
            )}
          </section>

          {checkpoints.length > 0 && (
            <section className="admin-panel">
              <h3>Checkpoint order</h3>
              <ol className="course-checkpoint-list">
                {checkpoints.map((checkpoint, index) => (
                  <li key={checkpoint.id || index} className={selectedKeys.includes(`checkpoints:${index}`) ? 'is-selected' : ''}>
                    <button type="button" onClick={() => setSelectedKeys([`checkpoints:${index}`])}>
                      {checkpoint.label || checkpoint.id}
                    </button>
                    <span>
                      <button type="button" onClick={() => moveCheckpoint(index, -1)} disabled={index === 0}>Up</button>
                      <button type="button" onClick={() => moveCheckpoint(index, 1)} disabled={index === checkpoints.length - 1}>Down</button>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="admin-panel">
            <h3>Cone layouts</h3>
            <CourseGeneratorTools onInsert={(cones) => mutate((current) => appendDecorations(current, cones))} />
          </section>
        </aside>
      </div>
    </div>
  )
}

export default CourseEditor
