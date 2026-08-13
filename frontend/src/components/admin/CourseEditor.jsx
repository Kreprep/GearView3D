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
import { emptySyllabus, NEXT_ROUTE_OPTIONS, SUMMARY_COUNTER_LABELS } from '../../data/courseDefaults'
import { COURSE_GOAL_TYPES, validateCourse } from '../../lib/courseGoals'
import { ReportingActivityFields, ShutdownActivityFields } from './ActivityContentFields'
import CourseCanvas from './CourseCanvas'
import CourseGeneratorTools from './CourseGeneratorTools'
import CourseInspector from './CourseInspector'
import './CourseEditor.css'

const KIND_LABELS = {
  briefing: 'Briefing',
  driving: 'Driving course',
  activity: 'Built-in activity',
  summary: 'Completion summary',
}

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
    data: source.data || null,
    content: source.content || null,
  }
}

function CourseEditor({ course, isForklift = false, onCourseChanged, onCourseDeleted, onMessage }) {
  const [draft, setDraft] = useState(() => draftOf(course))
  const [selectedKeys, setSelectedKeys] = useState([])
  const [tool, setTool] = useState(null)
  const [snap, setSnap] = useState(0.1)
  const [pxPerUnit, setPxPerUnit] = useState(24)
  const [bounds, setBounds] = useState(() => courseBounds(draftOf(course).data || {}))
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
    setBounds(courseBounds(next.data || {}))
    setSelectedKeys([])
    setTool(null)
    setDirty(false)
    setUndoStack([])
  }

  const stepKind = course.kind || 'driving'
  const isDriving = stepKind === 'driving'
  const data = draft.data
  const content = draft.content || {}
  const problems = useMemo(
    () => (isDriving ? validateCourse({ ...data, goalType: draft.goalType }) : []),
    [isDriving, data, draft.goalType],
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

  // Non-driving steps have no geometry, so the map helpers below must stay
  // safe against a null `data`.
  const selectedItem = isDriving && selectedKeys.length === 1 ? getItem(data, selectedKeys[0]) : null
  const checkpoints = data?.checkpoints || []

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

  const setContent = (patch) => {
    setDraft((current) => ({ ...current, content: { ...current.content, ...patch } }))
    setDirty(true)
  }

  const setSyllabus = (patch) =>
    setContent({ syllabus: { ...emptySyllabus(), ...content.syllabus, ...patch } })

  const toggleCounter = (key, on) => {
    const counters = new Set(content.counters || [])
    if (on) counters.add(key)
    else counters.delete(key)
    setContent({ counters: [...counters] })
  }

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
    for (const item of listCourseItems(data || {})) {
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
            <span className="course-badge kind">{KIND_LABELS[stepKind] || stepKind}</span>
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

      <div className={`course-editor-body ${isDriving ? '' : 'is-narrow'}`}>
        {stepKind === 'briefing' && (
          <section className="admin-panel course-editor-content">
            <h3>Briefing content</h3>
            <p className="admin-panel-note">
              The centre panel shows the reference image and panel text; the task panel on the right of the learner's
              screen shows the syllabus card and the lesson text. The scope notice is always shown and is not editable.
            </p>

            <label>
              Reference image URL
              <input
                value={content.image || ''}
                placeholder="/images/controls-wasd.png"
                onChange={(event) => setContent({ image: event.target.value })}
              />
            </label>
            {content.image && <img className="course-image-preview" src={content.image} alt="" />}

            <label>
              Panel text, centre (Markdown)
              <textarea rows={8} value={content.sceneBody || ''} onChange={(event) => setContent({ sceneBody: event.target.value })} />
            </label>

            <label>
              Lesson text, task panel (Markdown)
              <textarea rows={8} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
            </label>

            <label>
              Learning objectives, one per line
              <textarea
                rows={5}
                value={(content.objectives || []).join('\n')}
                onChange={(event) => setContent({ objectives: event.target.value.split('\n') })}
              />
            </label>
            <p className="admin-panel-note">
              These fill the Objectives sidebar on every step of the module, not only this one. Leave empty to use the
              module's built-in list.
            </p>

            <label className="course-checkbox">
              <input
                type="checkbox"
                checked={content.showSyllabus !== false}
                onChange={(event) => setContent({ showSyllabus: event.target.checked })}
              />
              Show the syllabus reference card
            </label>

            {content.showSyllabus !== false && (
              <>
                <label>
                  Syllabus location
                  <input
                    value={content.syllabus?.location || ''}
                    placeholder="Section 2"
                    onChange={(event) => setSyllabus({ location: event.target.value })}
                  />
                </label>
                <label>
                  Unit code
                  <input
                    value={content.syllabus?.unitCode || ''}
                    placeholder="505833315"
                    onChange={(event) => setSyllabus({ unitCode: event.target.value })}
                  />
                </label>
                <label>
                  Element
                  <input
                    value={content.syllabus?.element || ''}
                    placeholder="Element 4: Perform load handling operation"
                    onChange={(event) => setSyllabus({ element: event.target.value })}
                  />
                </label>
                <label>
                  Page references
                  <input
                    value={content.syllabus?.pageReferences || ''}
                    placeholder="pp. 55, 57-58"
                    onChange={(event) => setSyllabus({ pageReferences: event.target.value })}
                  />
                </label>
                <p className="admin-panel-note">
                  A blank field falls back to the module's built-in reference, and a row is hidden only when both are
                  empty.
                </p>
              </>
            )}
          </section>
        )}

        {stepKind === 'summary' && (
          <section className="admin-panel course-editor-content">
            <h3>Summary content</h3>
            <p className="admin-panel-note">
              The per-step Complete / Open grid is built automatically from this module's graded steps, so a step you
              add or remove appears here without any edit.
            </p>

            <label>
              Intro text (Markdown, optional)
              <textarea rows={4} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
            </label>

            <label>
              Message when the module is complete
              <textarea rows={2} value={content.completeMessage || ''} onChange={(event) => setContent({ completeMessage: event.target.value })} />
            </label>

            <label>
              Message while steps are outstanding
              <textarea rows={2} value={content.incompleteMessage || ''} onChange={(event) => setContent({ incompleteMessage: event.target.value })} />
            </label>

            {/* NEXT_ROUTE_OPTIONS are Forklift's fixed routes, and the generic
                module page ignores nextRoute (Submit always returns to the
                equipment's training hub) - so the picker only renders for
                Forklift modules. */}
            {isForklift ? (
              <label>
                Where Submit sends the learner
                <select
                  value={content.nextRoute || ''}
                  onChange={(event) => setContent({ nextRoute: event.target.value })}
                >
                  <option value="">Module default</option>
                  {NEXT_ROUTE_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="admin-panel-note">Submit returns the learner to this equipment's training hub.</p>
            )}

            <p className="admin-panel-note">Extra counters to show under the grid:</p>
            {Object.entries(SUMMARY_COUNTER_LABELS).map(([key, label]) => (
              <label key={key} className="course-checkbox">
                <input
                  type="checkbox"
                  checked={(content.counters || []).includes(key)}
                  onChange={(event) => toggleCounter(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </section>
        )}

        {stepKind === 'activity' && (
          <section className="admin-panel course-editor-content">
            <h3>Activity content</h3>
            <p className="admin-panel-note">
              This step runs the <strong>{content.activityId || 'unknown'}</strong> screen. The screen itself is code
              and cannot be swapped, but every card, answer and feedback line below is content. You can also reorder
              or delete the step.
            </p>

            {content.activityId === 'shutdown-sequence' && (
              <ShutdownActivityFields content={content} onChange={setContent} />
            )}
            {content.activityId === 'reporting' && (
              <ReportingActivityFields content={content} onChange={setContent} />
            )}
          </section>
        )}

        {(stepKind === 'checklist' || stepKind === 'quiz') && (
          <section className="admin-panel course-editor-content">
            <h3>{stepKind === 'checklist' ? 'Checklist step' : 'Quiz step'}</h3>
            <p className="admin-panel-note">
              This step shows the module's{' '}
              {stepKind === 'checklist' ? 'checklist items' : 'quiz questions'}, which are edited in the{' '}
              <strong>{stepKind === 'checklist' ? 'Checklists' : 'Quizzes'}</strong> tab rather than here - they
              belong to the module, not to this step. Neither kind blocks Next, so a learner is never stuck on one.
            </p>

            <label>
              Intro text (Markdown, optional)
              <textarea rows={4} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
            </label>

            <label>
              Task panel message
              <textarea
                rows={2}
                value={(stepKind === 'quiz' ? content.passMessage : content.completeMessage) || ''}
                onChange={(event) =>
                  setContent(stepKind === 'quiz'
                    ? { passMessage: event.target.value }
                    : { completeMessage: event.target.value })
                }
              />
            </label>
          </section>
        )}

        {isDriving && (
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
        )}

        <aside className="course-editor-side">
          <section className="admin-panel">
            <h3>Step text</h3>
            <label>Title<input value={draft.title} onChange={(event) => setField({ title: event.target.value })} /></label>
            <label>Objective<textarea rows={2} value={draft.objective} onChange={(event) => setField({ objective: event.target.value })} /></label>
            <label>Instructions<textarea rows={3} value={draft.instructions} onChange={(event) => setField({ instructions: event.target.value })} /></label>
            <label>Hint<textarea rows={2} value={draft.hint} onChange={(event) => setField({ hint: event.target.value })} /></label>
          </section>

          {isDriving && (
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
          )}

          {isDriving && (
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
          )}

          {isDriving && checkpoints.length > 0 && (
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

          {isDriving && (
            <section className="admin-panel">
              <h3>Cone layouts</h3>
              <CourseGeneratorTools onInsert={(cones) => mutate((current) => appendDecorations(current, cones))} />
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

export default CourseEditor
