import { translate } from '../../i18n/translate.js'
import { ALERT_RULES } from '../../lib/courseAlerts'
import { EVIDENCE_TYPES } from '../../lib/skillProgress'
import { describeEvidence } from '../../lib/skillText'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Checkbox, Input, Select } from '../ui/input'
import { PanelNote } from '../ui/panel'

const en = (key, values) => translate('en', key, values)

// The rules a run's tally counts. release-load is a hint, shown but never
// counted (lib/driving/safetyMonitor.js), so a clean run cannot be judged on it.
const COUNTED_RULES = ALERT_RULES.filter((alert) => alert.id !== 'release-load')

const TYPE_LABELS = {
  'step-complete': 'A step is complete',
  'clean-run': 'A driving step was completed without certain signs',
  'quiz-score': 'A quiz score',
  'parts-viewed': 'Every part viewed on the parts page',
  'caution-recovered': 'Recovered from a warning sign on a driving step',
}

// What a fresh rule of each type starts as.
function emptyRule(type, firstModule) {
  switch (type) {
    case 'step-complete':
      return { type, module: firstModule, stepId: '' }
    case 'clean-run':
      return { type, module: firstModule, stepId: '', rules: [], severity: 'any' }
    case 'quiz-score':
      return { type, module: firstModule, min: 80 }
    default:
      return { type }
  }
}

// The steps a rule can name: completion is recorded for driving, walk-around
// and built-in activity steps; a clean run only for driving steps.
function stepsFor(courses, moduleSlug, drivingOnly) {
  return courses.filter(
    (course) =>
      course.moduleSlug === moduleSlug &&
      (drivingOnly ? course.kind === 'driving' : ['driving', 'walk-around', 'activity'].includes(course.kind)),
  )
}

function RuleFields({ rule, onChange, modules, courses }) {
  const set = (patch) => onChange({ ...rule, ...patch })

  const moduleSelect = (
    <Field label="Module">
      <Select value={rule.module || ''} onChange={(event) => set({ module: event.target.value, stepId: '' })}>
        {modules.map((module) => <option key={module.slug} value={module.slug}>{module.title}</option>)}
      </Select>
    </Field>
  )

  const stepSelect = (drivingOnly) => (
    <Field label="Step">
      <Select value={rule.stepId || ''} onChange={(event) => set({ stepId: event.target.value })}>
        <option value="">Choose a step</option>
        {stepsFor(courses, rule.module, drivingOnly).map((course) => (
          <option key={course.id} value={course.id}>{course.title}</option>
        ))}
      </Select>
    </Field>
  )

  if (rule.type === 'step-complete') {
    return <div className="grid gap-3 md:grid-cols-2">{moduleSelect}{stepSelect(false)}</div>
  }

  if (rule.type === 'clean-run') {
    const chosen = rule.rules || []
    const toggle = (id, on) => set({ rules: on ? [...chosen, id] : chosen.filter((entry) => entry !== id) })
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          {moduleSelect}
          {stepSelect(true)}
          <Field label="Counts">
            <Select value={rule.severity || 'any'} onChange={(event) => set({ severity: event.target.value })}>
              <option value="any">Any sign for these rules</option>
              <option value="danger">Only danger-level signs</option>
            </Select>
          </Field>
        </div>
        <fieldset className="m-0 grid gap-1.5 border-0 p-0 md:grid-cols-2">
          <legend className="mb-1.5 text-[13.5px] font-bold text-body">Safety rules (none ticked means every rule)</legend>
          {COUNTED_RULES.map((alert) => (
            <Checkbox
              key={alert.id}
              label={alert.label}
              checked={chosen.includes(alert.id)}
              onChange={(event) => toggle(alert.id, event.target.checked)}
            />
          ))}
        </fieldset>
      </div>
    )
  }

  if (rule.type === 'quiz-score') {
    const source = rule.context === 'parts' ? 'parts' : rule.module || ''
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Quiz">
          <Select
            value={source}
            onChange={(event) => {
              const value = event.target.value
              onChange(value === 'parts' ? { type: rule.type, context: 'parts', min: rule.min } : { type: rule.type, module: value, min: rule.min })
            }}
          >
            {modules.map((module) => <option key={module.slug} value={module.slug}>{module.title} quiz</option>)}
            <option value="parts">Parts quiz</option>
          </Select>
        </Field>
        <Field label="Pass mark (%), on the latest attempt">
          <Input type="number" min={0} max={100} value={rule.min ?? 80} onChange={(event) => set({ min: Number(event.target.value) })} />
        </Field>
      </div>
    )
  }

  return null
}

// A skill's evidence list (lib/skillProgress.js's rule types), one row per
// rule with the fields its type takes and, under it, the sentence the learner
// will read. The server checks the list again on save.
function SkillEvidenceEditor({ evidence, onChange, modules, courses }) {
  const firstModule = modules[0]?.slug || ''
  const moduleTitles = Object.fromEntries(modules.map((module) => [module.slug, module.title]))
  const stepTitles = Object.fromEntries(courses.map((course) => [course.id, course.title]))

  const replace = (index, rule) => onChange(evidence.map((entry, at) => (at === index ? rule : entry)))

  return (
    <div className="grid gap-3">
      {evidence.length === 0 && (
        <PanelNote>No evidence: this skill can only be signed off by an instructor.</PanelNote>
      )}
      {evidence.map((rule, index) => (
        <div key={index} className="grid gap-3 rounded-xl border border-border p-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label={`Evidence ${index + 1}`} className="min-w-[260px] flex-1">
              <Select value={rule.type} onChange={(event) => replace(index, emptyRule(event.target.value, firstModule))}>
                {EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
              </Select>
            </Field>
            <Button variant="danger" size="sm" onClick={() => onChange(evidence.filter((_, at) => at !== index))}>
              Remove
            </Button>
          </div>
          <RuleFields rule={rule} onChange={(next) => replace(index, next)} modules={modules} courses={courses} />
          <p className="m-0 text-[13px] text-muted">
            Learners read: {describeEvidence(
              { ...rule, moduleTitle: moduleTitles[rule.module], stepTitle: stepTitles[rule.stepId] },
              en,
            )}
          </p>
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" onClick={() => onChange([...evidence, emptyRule('step-complete', firstModule)])}>
          Add evidence
        </Button>
      </div>
    </div>
  )
}

export default SkillEvidenceEditor
