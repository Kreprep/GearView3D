import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminAction } from '../../hooks/useAdminAction'
import { useLanguage } from '../../i18n'
import { resolveVehicleProfile } from '../../lib/vehicleProfile'
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
import { emptySyllabus, NEXT_ROUTE_TARGETS, SUMMARY_COUNTER_LABELS } from '../../data/courseDefaults'
import { MODULE_ROUTE_PREFIX } from '../../lib/moduleContent'
import { COURSE_GOAL_TYPES, DEFAULT_COURSE_BOUNDS, resolveCourseBounds, validateCourse } from '../../lib/courseGoals'
import { ReportingActivityFields, ShutdownActivityFields } from './ActivityContentFields'
import WalkAroundContentFields from './WalkAroundContentFields'
import CourseCanvas from './CourseCanvas'
import CourseGeneratorTools from './CourseGeneratorTools'
import CourseInspector from './CourseInspector'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select, Checkbox } from '../ui/input'
import { Toolbar } from '../ui/toolbar'
import { Badge } from '../ui/badge'

const KIND_LABELS = {
  briefing: 'Briefing',
  driving: 'Driving course',
  'walk-around': 'Walk-around',
  activity: 'Built-in activity',
  summary: 'Completion summary',
}

const GOAL_LABELS = {
  checkpoints: 'Checkpoint run',
  parking: 'Park in bay',
  pallet: 'Pallet delivery',
  racking: 'Rack storage',
  free: 'Free practice',
}

const GOAL_HINTS = {
  checkpoints: 'Completes when every checkpoint has been cleared in list order.',
  parking: 'Completes when the vehicle is inside the bay, aligned, stopped, any forks lowered and the engine off.',
  pallet: 'Completes when a pallet is lifted and set down inside the drop zone.',
  racking: 'Completes when a pallet is raised to its assigned shelf height and set down inside its target rack.',
  free: 'No built-in goal - completes when this course\'s own completion code returns true. Required below.',
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

// `equipment` is the Equipment row: the 3D preview drives with its vehicle
// profile overrides (footprint, seat), as the learner will. `modules` feeds
// the summary step's destination picker.
function CourseEditor({ course, equipment = null, modules = [], onCourseChanged, onCourseDeleted, onMessage }) {
  const language = useLanguage()
  const vehicleProfile = useMemo(() => resolveVehicleProfile(equipment, language), [equipment, language])
  const [draft, setDraft] = useState(() => draftOf(course))
  const [selectedKeys, setSelectedKeys] = useState([])
  const [tool, setTool] = useState(null)
  const [snap, setSnap] = useState(0.1)
  const [pxPerUnit, setPxPerUnit] = useState(24)
  const [bounds, setBounds] = useState(() => {
    const initial = draftOf(course).data || {}
    return courseBounds(initial, 3, resolveCourseBounds(initial))
  })
  const [dirty, setDirty] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSeed, setPreviewSeed] = useState(0)
  const [undoStack, setUndoStack] = useState([])

  // Local edits stay authoritative while the admin works - saving must not
  // wipe their selection - so props are only pulled back in after an action
  // that replaces the content server-side (reset / discard draft). Switching
  // to a different step remounts the editor via its key in CourseAdmin.
  const resyncFrom = (nextCourse) => {
    const next = draftOf(nextCourse)
    setDraft(next)
    setBounds(courseBounds(next.data || {}, 3, resolveCourseBounds(next.data || {})))
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

  // Course size is a deliberate "resize the arena" action, unlike dragging an
  // object, so the map view re-fits immediately instead of waiting for the
  // admin to notice and click Fit view.
  const setCourseBoundsValue = (nextBounds) => {
    const nextData = { ...data, bounds: nextBounds }
    commitData(nextData)
    setBounds(courseBounds(nextData, 3, resolveCourseBounds(nextData)))
  }

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

  const { busy, run } = useAdminAction(onMessage, (result, { resync = false } = {}) => {
    if (result?.course) {
      onCourseChanged(result.course)
      setDirty(false)
      if (resync) resyncFrom(result.course)
    }
  })

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
    const result = await run(() => adminDeleteCourse(course.id), 'Course deleted.')
    if (result) onCourseDeleted(course.id)
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
    <div className="grid gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-panel p-4">
        <div>
          <h2 className="m-0 text-[18px] font-extrabold text-ink">{draft.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {course.id} - {course.moduleSlug}
            <Badge tone="accent">{KIND_LABELS[stepKind] || stepKind}</Badge>
            {course.draft && <Badge tone="warning">Unpublished draft</Badge>}
            {!course.published && <Badge tone="neutral">Not visible to learners</Badge>}
            {dirty && <Badge tone="danger">Unsaved changes</Badge>}
          </p>
        </div>
        <Toolbar className="mt-0">
          <Button type="button" variant="secondary" onClick={saveDraft} disabled={busy}>Save draft</Button>
          <Button type="button" onClick={publish} disabled={busy}>Publish</Button>
          {course.draft && <Button type="button" variant="secondary" onClick={revert} disabled={busy}>Discard draft</Button>}
          {course.builtIn && <Button type="button" variant="secondary" onClick={reset} disabled={busy}>Reset to default</Button>}
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>Delete step</Button>
        </Toolbar>
      </header>

      {problems.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-red-900">
          <strong>Cannot publish yet:</strong>
          <ul className="mt-1.5 pl-5">
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-4 [grid-template-columns:minmax(0,1fr)_minmax(300px,380px)] max-[1100px]:grid-cols-1">
        {stepKind === 'briefing' && (
          <Panel>
            <PanelHeader>Briefing content</PanelHeader>
            <PanelNote>
              The centre panel shows the reference image and panel text; the task panel on the right of the learner's
              screen shows the syllabus card and the lesson text. The scope notice is always shown and is not editable.
            </PanelNote>

            <div className="mt-3 grid gap-3">
              <Field label="Reference image URL">
                <Input
                  value={content.image || ''}
                  placeholder="/images/controls-wasd.png"
                  onChange={(event) => setContent({ image: event.target.value })}
                />
              </Field>
              {content.image && <img className="max-w-full rounded-lg border border-border bg-ink" src={content.image} alt="" />}

              <Field label="Panel text, centre (Markdown)">
                <Textarea rows={8} value={content.sceneBody || ''} onChange={(event) => setContent({ sceneBody: event.target.value })} />
              </Field>

              <Field label="Lesson text, task panel (Markdown)">
                <Textarea rows={8} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
              </Field>

              <Field label="Learning objectives, one per line">
                <Textarea
                  rows={5}
                  value={(content.objectives || []).join('\n')}
                  onChange={(event) => setContent({ objectives: event.target.value.split('\n') })}
                />
              </Field>
              <PanelNote>
                These fill the Objectives sidebar on every step of the module, not only this one. Leave empty to use the
                module's built-in list.
              </PanelNote>

              <Checkbox
                label="Show the syllabus reference card"
                checked={content.showSyllabus !== false}
                onChange={(event) => setContent({ showSyllabus: event.target.checked })}
              />

              {content.showSyllabus !== false && (
                <>
                  <Field label="Syllabus location">
                    <Input
                      value={content.syllabus?.location || ''}
                      placeholder="Section 2"
                      onChange={(event) => setSyllabus({ location: event.target.value })}
                    />
                  </Field>
                  <Field label="Unit code">
                    <Input
                      value={content.syllabus?.unitCode || ''}
                      placeholder="505833315"
                      onChange={(event) => setSyllabus({ unitCode: event.target.value })}
                    />
                  </Field>
                  <Field label="Element">
                    <Input
                      value={content.syllabus?.element || ''}
                      placeholder="Element 4: Perform load handling operation"
                      onChange={(event) => setSyllabus({ element: event.target.value })}
                    />
                  </Field>
                  <Field label="Page references">
                    <Input
                      value={content.syllabus?.pageReferences || ''}
                      placeholder="pp. 55, 57-58"
                      onChange={(event) => setSyllabus({ pageReferences: event.target.value })}
                    />
                  </Field>
                  <PanelNote>
                    A blank field falls back to the module&apos;s built-in reference, and a row is hidden only when both are
                    empty.
                  </PanelNote>
                </>
              )}
            </div>
          </Panel>
        )}

        {stepKind === 'summary' && (
          <Panel>
            <PanelHeader>Summary content</PanelHeader>
            <PanelNote>
              The per-step Complete / Open grid is built automatically from this module's graded steps, so a step you
              add or remove appears here without any edit.
            </PanelNote>

            <div className="mt-3 grid gap-3">
              <Field label="Intro text (Markdown, optional)">
                <Textarea rows={4} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
              </Field>

              <Field label="Message when the module is complete">
                <Textarea rows={2} value={content.completeMessage || ''} onChange={(event) => setContent({ completeMessage: event.target.value })} />
              </Field>

              <Field label="Message while steps are outstanding">
                <Textarea rows={2} value={content.incompleteMessage || ''} onChange={(event) => setContent({ incompleteMessage: event.target.value })} />
              </Field>

              {/* The per-module entries are built from the modules that
                  actually exist, rather than a fixed list. */}
              <Field
                label="Where Submit sends the learner"
                note="Blank keeps the module's built-in destination. A stored value that no longer resolves falls back to it too, so deleting a module never strands another module's Submit."
              >
                <Select
                  value={content.nextRoute || ''}
                  onChange={(event) => setContent({ nextRoute: event.target.value })}
                >
                  <option value="">Module default</option>
                  {NEXT_ROUTE_TARGETS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                  {modules
                    .filter((entry) => entry.slug !== course.moduleSlug)
                    .map((entry) => (
                      <option key={entry.slug} value={`${MODULE_ROUTE_PREFIX}${entry.slug}`}>
                        Module - {entry.title || entry.slug}
                      </option>
                    ))}
                </Select>
              </Field>

              <div>
                <PanelNote>Extra counters to show under the grid:</PanelNote>
                <div className="mt-2 grid gap-1.5">
                  {Object.entries(SUMMARY_COUNTER_LABELS).map(([key, label]) => (
                    <Checkbox
                      key={key}
                      label={label}
                      checked={(content.counters || []).includes(key)}
                      onChange={(event) => toggleCounter(key, event.target.checked)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {stepKind === 'activity' && (
          <Panel>
            <PanelHeader>Activity content</PanelHeader>
            <PanelNote>
              This step runs the <strong>{content.activityId || 'unknown'}</strong> screen. The screen itself is code
              and cannot be swapped, but every card, answer and feedback line below is content. You can also reorder
              or delete the step.
            </PanelNote>

            {content.activityId === 'shutdown-sequence' && (
              <ShutdownActivityFields content={content} onChange={setContent} />
            )}
            {content.activityId === 'reporting' && (
              <ReportingActivityFields content={content} onChange={setContent} />
            )}
          </Panel>
        )}

        {stepKind === 'walk-around' && (
          <Panel>
            <PanelHeader>Walk-around content</PanelHeader>
            <PanelNote>
              What this inspection step asks the learner to do - which checks/gauges/devices/scenarios must be
              completed and their text. Each item&apos;s 3D marker (position, phase visibility, defect behaviour) is
              edited in the Inspection Hotspots panel below, matched to the ids here - the same rows Parts
              Identification edits, so a marker that is also a part is one hotspot, not a copy.
            </PanelNote>

            <Field label="Intro text (Markdown, optional)" className="mt-3">
              <Textarea rows={3} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
            </Field>

            <WalkAroundContentFields
              data={data || {}}
              onChange={(nextData) => { setDraft((current) => ({ ...current, data: nextData })); setDirty(true) }}
            />
          </Panel>
        )}

        {(stepKind === 'checklist' || stepKind === 'quiz') && (
          <Panel>
            <PanelHeader>{stepKind === 'checklist' ? 'Checklist step' : 'Quiz step'}</PanelHeader>
            <PanelNote>
              This step shows the module&apos;s{' '}
              {stepKind === 'checklist' ? 'checklist items' : 'quiz questions'}, edited in the panel below - they
              belong to the module, so every {stepKind} step of it shows the same rows. Neither kind blocks Next,
              so a learner is never stuck on one.
            </PanelNote>

            <div className="mt-3 grid gap-3">
              <Field label="Intro text (Markdown, optional)">
                <Textarea rows={4} value={content.body || ''} onChange={(event) => setContent({ body: event.target.value })} />
              </Field>

              <Field label="Task panel message">
                <Textarea
                  rows={2}
                  value={(stepKind === 'quiz' ? content.passMessage : content.completeMessage) || ''}
                  onChange={(event) =>
                    setContent(stepKind === 'quiz'
                      ? { passMessage: event.target.value }
                      : { completeMessage: event.target.value })
                  }
                />
              </Field>
            </div>
          </Panel>
        )}

        {isDriving && (
        <section className="grid min-w-0 gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Place</span>
            {PLACEABLE_KINDS.filter((kind) => !(kind === 'dropZone' && data.dropZone) && !(kind === 'parkingBay' && data.parkingBay)).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={tool === kind ? 'default' : 'secondary'}
                onClick={() => setTool(tool === kind ? null : kind)}
              >
                {OBJECT_LABELS[kind]}
              </Button>
            ))}
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              Snap
              <Select style={{ width: 'auto' }} value={snap} onChange={(event) => setSnap(Number(event.target.value))}>
                {SNAP_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
              </Select>
            </label>
            <Button type="button" size="sm" variant="secondary" onClick={() => setPxPerUnit((value) => Math.max(8, value - 6))}>-</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setPxPerUnit((value) => Math.min(80, value + 6))}>+</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setBounds(courseBounds(data, 3, resolveCourseBounds(data)))}>Fit view</Button>
            <Button type="button" size="sm" variant="secondary" onClick={undo} disabled={!undoStack.length}>Undo</Button>
          </div>

          <PanelNote>
            Seen from the driver&apos;s seat: forward (+Z) is up the map and the vehicle&apos;s right is the right of the map.
            Drag to move, Shift-click to multi-select, Delete to remove.
          </PanelNote>

          <CourseCanvas
            data={data}
            bounds={bounds}
            driveBounds={resolveCourseBounds(data)}
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

          <PanelNote>
            {Object.entries(itemCounts).map(([kind, count]) => `${OBJECT_LABELS[kind] || kind}: ${count}`).join('  |  ')}
          </PanelNote>

          {/* The preview is the same heavy Three.js scene the learner drives, so
              it is only mounted on request - otherwise every course selection
              would spin up a WebGL context alongside the map. */}
          <div className="grid justify-items-start gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowPreview((value) => !value)}>
              {showPreview ? 'Hide 3D preview' : 'Show 3D preview'}
            </Button>
            {showPreview && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewSeed((seed) => seed + 1)}>Reload preview</Button>
                <div className="min-h-[420px] w-full">
                  <DrivingSimulationViewer profile={vehicleProfile} course={previewCourse} isAdmin />
                </div>
                <PanelNote>
                  The preview uses the unsaved draft. Reload it after moving objects to drive the new layout.
                </PanelNote>
              </>
            )}
          </div>
        </section>
        )}

        <aside className="grid min-w-0 gap-3">
          <Panel>
            <PanelHeader>Step text</PanelHeader>
            <div className="mt-3 grid gap-3">
              <Field label="Title"><Input value={draft.title} onChange={(event) => setField({ title: event.target.value })} /></Field>
              <Field label="Objective"><Textarea rows={2} value={draft.objective} onChange={(event) => setField({ objective: event.target.value })} /></Field>
              <Field label="Instructions"><Textarea rows={3} value={draft.instructions} onChange={(event) => setField({ instructions: event.target.value })} /></Field>
              <Field label="Hint"><Textarea rows={2} value={draft.hint} onChange={(event) => setField({ hint: event.target.value })} /></Field>
            </div>
          </Panel>

          {isDriving && (
          <Panel>
            <PanelHeader>Goal</PanelHeader>
            <div className="mt-3 grid gap-3">
              <Field label="Completion rule">
                <Select value={draft.goalType} onChange={(event) => setField({ goalType: event.target.value })}>
                  {COURSE_GOAL_TYPES.map((value) => <option key={value} value={value}>{GOAL_LABELS[value]}</option>)}
                </Select>
              </Field>
              <PanelNote>{GOAL_HINTS[draft.goalType]}</PanelNote>

              {draft.goalType === 'free' && (
                <Field label="Custom completion code (JavaScript, required)">
                  <Textarea
                    rows={6}
                    spellCheck={false}
                    className="font-mono text-[13px]"
                    value={data.completionCode || ''}
                    onChange={(event) => setCourseValue({ completionCode: event.target.value || null })}
                  />
                </Field>
              )}
              {draft.goalType === 'free' && (
                <PanelNote>
                  Runs in every learner's browser inside a sandboxed worker (no access to the page or their login) each
                  time they press a key, start the engine or work the seatbelt or parking brake. Receives{' '}
                  <code>context.keysUsed</code> (array of key strings pressed so far), <code>context.engineStarted</code>{' '}
                  (boolean), and <code>context.seatbelt</code> / <code>context.parkingBrake</code> (whether each is on
                  right now); return a truthy value once
                  the step should complete, e.g. <code>return context.engineStarted &amp;&amp; context.keysUsed.includes(&apos;w&apos;)</code>.
                  A free-practice course cannot be published without this. Describe the actual requirement to learners
                  in this step's Instructions or Hint field above.
                </PanelNote>
              )}

              <Field label="Rated capacity (kg, blank for no limit)">
                <Input
                  type="number"
                  step={50}
                  value={data.capacityKg ?? ''}
                  onChange={(event) => setCourseValue({ capacityKg: event.target.value === '' ? null : Number(event.target.value) })}
                />
              </Field>
              <Checkbox
                label="Fail on lifting over capacity"
                checked={Boolean(data.failConditions?.overload)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, overload: event.target.checked } })}
              />
              <Checkbox
                label="Fail on braking hard while carrying"
                checked={Boolean(data.failConditions?.suddenStop)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, suddenStop: event.target.checked } })}
              />
              <Checkbox
                label="Fail on driving fast with forks raised"
                checked={Boolean(data.failConditions?.highTravel)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, highTravel: event.target.checked } })}
              />
              <Checkbox
                label="Fail on turning sharply at speed while carrying"
                checked={Boolean(data.failConditions?.sharpTurn)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, sharpTurn: event.target.checked } })}
              />
              <Checkbox
                label="Fail on travelling with the mast not tilted back"
                checked={Boolean(data.failConditions?.unsecuredTravel)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, unsecuredTravel: event.target.checked } })}
              />
              <Checkbox
                label="Fail on tilting a heavy load forward up high"
                checked={Boolean(data.failConditions?.loadTipping)}
                onChange={(event) => setCourseValue({ failConditions: { ...data.failConditions, loadTipping: event.target.checked } })}
              />
              <PanelNote>
                Braking hard, turning sharply and travelling mast-forward only lose the load when the forks went in
                partway: a pallet driven fully onto the forks and centred rides all three out, and tilting the mast back
                saves most of the rest. The tip-over rules need a rated capacity to judge "too heavy" against, so they do
                nothing while the field above is blank.
              </PanelNote>
              <PanelNote>
                Cones, walls, parked vehicles and racking are always live colliders. Striking a cone, wall or parked
                vehicle always fails the attempt; racking stops the truck at any speed but only fails it when hit at
                travelling speed, since placing a load puts the nose at the rack&apos;s face on purpose. Pallets are
                solid too, but they only block the truck, since driving into a pallet is how the forks go in.
              </PanelNote>
              <PanelNote>
                Setting a load down is always two moves, on the floor and on a shelf alike: lower it until the surface
                takes its weight, then tilt the mast forward to let it off the tines. This is a mechanic, not a fail
                rule, so it applies to every driving course.
              </PanelNote>
            </div>
          </Panel>
          )}

          {isDriving && (
          <Panel>
            <PanelHeader>Course size</PanelHeader>
            <PanelNote>
              The box the vehicle can actually drive in - shown as the dashed outline on the map. Placing an object
              outside it makes the course unwinnable, since the vehicle can never reach it.
            </PanelNote>
            <div className="mt-3 grid gap-3">
              <Field label="Width (± units from center)">
                <Input
                  type="number"
                  step={0.5}
                  min={0.5}
                  value={resolveCourseBounds(data).halfWidth}
                  onChange={(event) => setCourseBoundsValue({ ...resolveCourseBounds(data), halfWidth: Number(event.target.value) })}
                />
              </Field>
              <Field label="Back limit (units behind start)">
                <Input
                  type="number"
                  step={0.5}
                  value={resolveCourseBounds(data).minZ}
                  onChange={(event) => setCourseBoundsValue({ ...resolveCourseBounds(data), minZ: Number(event.target.value) })}
                />
              </Field>
              <Field label="Forward limit (units ahead)">
                <Input
                  type="number"
                  step={0.5}
                  value={resolveCourseBounds(data).maxZ}
                  onChange={(event) => setCourseBoundsValue({ ...resolveCourseBounds(data), maxZ: Number(event.target.value) })}
                />
              </Field>
              {data.bounds && (
                <Button type="button" size="sm" variant="secondary" className="justify-self-start" onClick={() => setCourseBoundsValue(null)}>
                  Reset to default size ({DEFAULT_COURSE_BOUNDS.halfWidth * 2} × {DEFAULT_COURSE_BOUNDS.maxZ - DEFAULT_COURSE_BOUNDS.minZ})
                </Button>
              )}
            </div>
          </Panel>
          )}

          {isDriving && (
          <Panel>
            <PanelHeader>Selected object</PanelHeader>
            <div className="mt-3">
              <CourseInspector
                item={selectedItem}
                racks={data?.racks || []}
                onChange={(patch) => commitData(updateItem(data, selectedItem.key, patch))}
                onMove={(x, z) => commitData(moveItem(data, selectedItem.key, x, z))}
                onDelete={deleteSelected}
              />
              {selectedKeys.length > 1 && (
                <PanelNote className="mt-2">{selectedKeys.length} objects selected. Delete removes all of them.</PanelNote>
              )}
            </div>
          </Panel>
          )}

          {isDriving && checkpoints.length > 0 && (
            <Panel>
              <PanelHeader>Checkpoint order</PanelHeader>
              <ol className="m-0 mt-2 grid list-none gap-1.5 p-0">
                {checkpoints.map((checkpoint, index) => (
                  <li
                    key={checkpoint.id || index}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] ${
                      selectedKeys.includes(`checkpoints:${index}`) ? 'border-accent bg-accent-soft font-bold text-ink' : 'border-transparent text-body'
                    }`}
                  >
                    <button type="button" className="text-left" onClick={() => setSelectedKeys([`checkpoints:${index}`])}>
                      {checkpoint.label || checkpoint.id}
                    </button>
                    <span className="flex flex-none gap-1">
                      <Button type="button" size="sm" variant="secondary" onClick={() => moveCheckpoint(index, -1)} disabled={index === 0}>Up</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => moveCheckpoint(index, 1)} disabled={index === checkpoints.length - 1}>Down</Button>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {isDriving && (
            <Panel>
              <PanelHeader>Cone layouts</PanelHeader>
              <div className="mt-3">
                <CourseGeneratorTools onInsert={(cones) => mutate((current) => appendDecorations(current, cones))} />
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  )
}

export default CourseEditor
