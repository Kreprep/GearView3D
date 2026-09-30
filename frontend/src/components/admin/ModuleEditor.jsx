import { useEffect, useMemo, useState } from 'react'
import { adminCreateCourse, adminListCourses, adminReorderCourses, adminUpdateModule } from '../../lib/api'
import ChecklistAdmin from './ChecklistAdmin'
import CourseEditor from './CourseEditor'
import HotspotAdmin from './HotspotAdmin'
import ModuleSkillLinks from './ModuleSkillLinks'
import QuizAdmin from './QuizAdmin'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Select, Textarea } from '../ui/input'
import { Badge } from '../ui/badge'

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
  equipment,
  modules,
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
        <div className="grid min-h-[220px] content-center justify-start gap-2 rounded-2xl border border-dashed border-border bg-slate-50 p-5">
          <h3 className="m-0 text-sm font-extrabold text-ink">No step selected</h3>
          <PanelNote>
            Pick a step on the left to edit it, or add one at the bottom of the list. A step&apos;s panel changes
            with its type - a driving course gets the 3D map, a walk-around its inspection checks, a quiz its
            questions.
          </PanelNote>
        </div>
      )
    }

    // Checklist, quiz and walk-around steps render rows that belong to the
    // module or to the model, so their panel is the step's own editor plus
    // those rows.
    const stepEditor = () => (
      <CourseEditor
        key={selected.id}
        course={selected}
        equipment={equipment}
        modules={modules}
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

    // A walk-around step's markers are rows of the one hotspot table, so they are
    // placed here, beside the checks that reference them. It is the same
    // editor Parts Identification uses, scoped to the walk-around surface - a
    // hotspot ticked for both surfaces is one row, edited in either place.
    if (selected.kind === 'walk-around') {
      return (
        <>
          {stepEditor()}
          <Panel>
            <PanelHeader>Inspection Hotspots</PanelHeader>
            <PanelNote>
              The markers this step shows on the model - not the checks themselves (that&apos;s the Walk-around
              content panel above). Click the model to place one, or drag a marker to move it; each has its own
              draft and publish. A marker that is also a part shows up under Parts Identification - it is the same
              hotspot, not a copy.
            </PanelNote>
            <HotspotAdmin
              categories={hotspotCategories}
              surface="walk-around"
              onMessage={onMessage}
            />
          </Panel>
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
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-panel px-4 py-3">
        <Button variant="secondary" size="sm" onClick={onBack}>Back to modules</Button>
        <div className="grid min-w-0 gap-0.5">
          <p className="m-0 text-[13px] font-semibold text-accent-strong">Module Editor</p>
          <h2 className="m-0 text-[19px] font-black leading-tight text-ink">{module.fullTitle || module.title}</h2>
        </div>
        <span className="ml-auto whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-extrabold text-muted">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
      </header>

      <Panel>
        <PanelHeader actions={<Button onClick={saveModule}>Save module</Button>}>Module Details</PanelHeader>
        <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <Field label="Title">
            <Input value={fields.title || ''} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
          </Field>
          <Field label="Subtitle">
            <Input value={fields.subtitle || ''} onChange={(event) => setFields({ ...fields, subtitle: event.target.value })} />
          </Field>
          <Field label="Full title" note="The long heading on the module page itself. Blank falls back to the title.">
            <Input value={fields.fullTitle || ''} placeholder={fields.title} onChange={(event) => setFields({ ...fields, fullTitle: event.target.value })} />
          </Field>
          <Field label="Image URL">
            <Input value={fields.imageUrl || ''} onChange={(event) => setFields({ ...fields, imageUrl: event.target.value })} />
          </Field>
          <Field label="Description" note="Shown on the module card in the learner's module list." className="col-span-full">
            <Textarea rows={3} value={fields.description || ''} onChange={(event) => setFields({ ...fields, description: event.target.value })} />
          </Field>
        </div>
      </Panel>

      <ModuleSkillLinks module={module} onMessage={onMessage} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader>Steps</PanelHeader>
          <PanelNote>
            Every step of this module, in the order learners see it. Built-in activities keep their hardcoded
            screens but can still be reordered or removed.
          </PanelNote>
          {loadState.loading && <PanelNote className="mt-2">Loading steps...</PanelNote>}
          {loadState.error && <PanelNote className="mt-2">Steps could not be loaded: {loadState.error}</PanelNote>}

          <ol className="m-0 mt-2 grid list-none gap-1.5 p-0">
            {steps.map((course, index) => (
              <li key={course.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`grid flex-1 gap-0.5 rounded-lg border px-2 py-2 text-left transition ${
                    course.id === selectedId ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-slate-100'
                  }`}
                  onClick={() => setSelectedId(course.id)}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-extrabold ${
                        course.id === selectedId ? 'bg-accent text-white' : 'bg-slate-200 text-body'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <strong className="line-clamp-2 block text-[13.5px] font-bold leading-snug text-ink">{course.title}</strong>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                        {KIND_LABELS[course.kind] || course.kind}
                        {course.draft && <Badge tone="warning">draft</Badge>}
                        {!course.published && <Badge tone="danger">unpublished</Badge>}
                        {!course.builtIn && <Badge tone="accent">custom</Badge>}
                      </span>
                    </span>
                  </span>
                </button>
                <span className="flex flex-none flex-col gap-1">
                  <Button size="sm" variant="secondary" title="Move up" onClick={() => moveStep(index, -1)} disabled={index === 0}>Up</Button>
                  <Button size="sm" variant="secondary" title="Move down" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>Down</Button>
                </span>
              </li>
            ))}
          </ol>

          {!loadState.loading && steps.length === 0 && <PanelNote className="mt-2">No steps in this module yet.</PanelNote>}

          <div className="mt-3 grid gap-2.5 border-t border-slate-200 pt-3">
            <Field label="New step title">
              <Input value={newTitle} placeholder="Narrow Aisle Turn" onChange={(event) => setNewTitle(event.target.value)} />
            </Field>
            <Field label="Step type">
              <Select value={newKind} onChange={(event) => setNewKind(event.target.value)}>
                {creatableKinds.map((value) => (
                  <option key={value} value={value}>{KIND_LABELS[value] || value}</option>
                ))}
              </Select>
            </Field>
            <Button onClick={createStep} disabled={!newTitle.trim()}>Add step</Button>
          </div>
        </Panel>

        <div className="grid gap-4">{renderStepPanel()}</div>
      </div>
    </div>
  )
}

export default ModuleEditor
