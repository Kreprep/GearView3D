import { useEffect, useState } from 'react'
import { DEFECT_LIBRARY, DEFECT_VIEWS, defectsForView } from '../../data/defectLibrary'
import { getHotspots } from '../../lib/api'
import { translate } from '../../i18n/translate'
import { locateCandidates, normalizeScenario, QUESTION_PROMPT_KEYS, QUESTION_TYPES, SCENARIO_DEMOS, USABLE_CHOICES } from '../../lib/walkAroundStep'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Checkbox, Input, Select, Textarea } from '../ui/input'
import { PanelNote } from '../ui/panel'
import { ListEditor } from './ListEditor'

// The defect test's scenarios (docs/modules/module-improvements-plan.md, 3.4;
// the shape is in lib/walkAroundStep.js). Each scenario picks its view, its
// defects from the code-owned library (data/defectLibrary.js), one question
// and the feedback. A row saved in the old shape (a free-text visual state)
// is shown normalized, and saved in the new shape on its first edit. The
// server checks the result on publish (defectScenarioProblems).

const VIEW_LABELS = { exterior: 'Walk-around (outside the truck)', cab: 'Cab (from the seat, engine can be started)' }

const TYPE_LABELS = {
  usable: 'Usable: may this forklift be used? (Yes / No)',
  identify: 'Identify: what is wrong? (your choices)',
  locate: 'Locate: click the defect on the model',
  action: 'Action: what do you do? (your choices)',
}

const DEMO_LABELS = {
  'brake-test': 'Brake test',
  steering: 'Steering',
  'lift-tilt': 'Lift and tilt',
  travel: 'Forward and reverse travel',
}

// The keys the old shape used, cleared when a row is saved in the new one.
const LEGACY_KEYS = { title: undefined, visualState: undefined, choices: undefined, answer: undefined, deviceEffectId: undefined, demoLabel: undefined }

const STOCK_ACTION_CHOICES = [
  'Report it and tag the forklift out of service',
  'Use it carefully until the end of the shift',
  'Fix it yourself before using it',
]

function nextScenarioId(scenarios) {
  const taken = new Set(scenarios.map((scenario) => scenario.id))
  let n = scenarios.length + 1
  while (taken.has(`forklift-${n}`)) n += 1
  return `forklift-${n}`
}

// One scenario's fields. `scenario` is normalized; `save(next)` stores a
// whole scenario in the current shape.
function ScenarioFields({ scenario, save, partOptions }) {
  const { view, defects, question } = scenario
  const update = (changes) => save({ ...scenario, ...changes })
  const updateQuestion = (changes) => update({ question: { ...question, ...changes } })
  const types = view === 'cab' ? QUESTION_TYPES.filter((type) => type !== 'locate') : QUESTION_TYPES
  const answerPart = defects.map((id) => DEFECT_LIBRARY[id]?.hotspotId).find(Boolean)

  const setView = (next) => {
    // A defect of the other view can't stay, nor can a locate question in the cab.
    const keep = defects.filter((id) => DEFECT_LIBRARY[id]?.view === next)
    const type = next === 'cab' && question.type === 'locate' ? 'usable' : question.type
    update({ view: next, defects: keep, demo: next === 'cab' ? null : scenario.demo, question: { ...question, type, answer: type === question.type ? question.answer : 'No' } })
  }

  const setType = (type) => {
    if (type === 'usable') updateQuestion({ type, choices: USABLE_CHOICES.map(({ value }) => value), answer: defects.length ? 'No' : 'Yes' })
    else if (type === 'locate') updateQuestion({ type, choices: [], answer: answerPart || '' })
    else if (type === 'action') updateQuestion({ type, choices: STOCK_ACTION_CHOICES, answer: STOCK_ACTION_CHOICES[0] })
    else updateQuestion({ type, choices: [], answer: '' })
  }

  const toggleDefect = (id) => update({ defects: defects.includes(id) ? defects.filter((entry) => entry !== id) : [...defects, id] })

  return (
    <>
      <Field label="Id">
        <Input value={scenario.id || ''} onChange={(event) => update({ id: event.target.value })} />
      </Field>
      <Field label="Where the learner checks it">
        <Select value={view} onChange={(event) => setView(event.target.value)}>
          {DEFECT_VIEWS.map((value) => (
            <option key={value} value={value}>{VIEW_LABELS[value]}</option>
          ))}
        </Select>
      </Field>

      <fieldset className="col-span-full m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-1.5 rounded-lg border border-border p-2.5">
        <legend className="px-1 text-xs font-bold text-body">Defects (none: a good forklift)</legend>
        {defectsForView(view).map((id) => (
          <Checkbox key={id} label={DEFECT_LIBRARY[id].label} checked={defects.includes(id)} onChange={() => toggleDefect(id)} />
        ))}
      </fieldset>

      <Field label="Question">
        <Select value={question.type} onChange={(event) => setType(event.target.value)}>
          {types.map((type) => (
            <option key={type} value={type}>{TYPE_LABELS[type]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Question text (optional)" className="col-span-full">
        <Input
          value={question.prompt}
          placeholder={translate('en', QUESTION_PROMPT_KEYS[question.type])}
          onChange={(event) => updateQuestion({ prompt: event.target.value })}
        />
      </Field>
      <PanelNote className="col-span-full">
        Left blank, the learner sees the standard question for its type, in their language. Text you write here is shown as written.
      </PanelNote>

      {(question.type === 'identify' || question.type === 'action') && (
        <Field label="Choices (one per line)" className="col-span-full">
          <Textarea
            rows={3}
            value={question.choices.join('\n')}
            onChange={(event) => updateQuestion({ choices: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
          />
        </Field>
      )}

      <Field label="Correct answer">
        {question.type === 'usable' && (
          <Select value={question.answer} onChange={(event) => updateQuestion({ answer: event.target.value })}>
            {USABLE_CHOICES.map(({ value }) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        )}
        {(question.type === 'identify' || question.type === 'action') && (
          <Select value={question.answer} onChange={(event) => updateQuestion({ answer: event.target.value })}>
            <option value="">Pick one of the choices</option>
            {question.choices.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </Select>
        )}
        {question.type === 'locate' && (
          <Select value={question.answer} onChange={(event) => updateQuestion({ answer: event.target.value })}>
            <option value="">Pick the part to click</option>
            {partOptions.map((hotspot) => (
              <option key={hotspot.id} value={hotspot.id}>{hotspot.label}</option>
            ))}
          </Select>
        )}
      </Field>
      {question.type === 'locate' && answerPart && question.answer !== answerPart && (
        <Button type="button" size="sm" variant="secondary" className="self-end justify-self-start" onClick={() => updateQuestion({ answer: answerPart })}>
          Use the defect&apos;s part
        </Button>
      )}

      {view === 'exterior' && (
        <Field label="Demo the learner can play (optional)">
          <Select value={scenario.demo || ''} onChange={(event) => update({ demo: event.target.value || null })}>
            <option value="">None</option>
            {Object.keys(SCENARIO_DEMOS).map((demo) => (
              <option key={demo} value={demo}>{DEMO_LABELS[demo] || demo}</option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Feedback (shown once answered)" className="col-span-full">
        <Textarea rows={3} value={scenario.feedback} onChange={(event) => update({ feedback: event.target.value })} />
      </Field>
    </>
  )
}

export function DefectScenarioFields({ scenarios, onChange }) {
  // The walk-around parts a locate question can name.
  const [parts, setParts] = useState([])
  useEffect(() => {
    let cancelled = false
    getHotspots('walk-around')
      .then((hotspots) => {
        if (!cancelled) setParts(locateCandidates(hotspots))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ListEditor
      title="Defect scenarios"
      note="Each scenario is one forklift with the defects you pick (or none), and one question. Learners meet the scenarios in a shuffled order, titled only &quot;Forklift 3 of 10&quot;, so nothing here names the answer to them. Every scenario must be answered correctly to pass; the first answer to each is the score."
      items={scenarios}
      onChange={onChange}
      emptyItem={() => ({
        id: nextScenarioId(scenarios),
        view: 'exterior',
        defects: [],
        question: { type: 'usable', prompt: '', choices: USABLE_CHOICES.map(({ value }) => value), answer: 'Yes' },
        demo: null,
        feedback: '',
      })}
      legendFor={(item, index) => {
        const scenario = normalizeScenario(item)
        const names = scenario.defects.map((id) => DEFECT_LIBRARY[id]?.label || id)
        return `Scenario ${index + 1}: ${names.length ? names.join(', ') : 'good forklift'} (${scenario.question.type})`
      }}
      renderFields={(item, patch) => (
        <ScenarioFields scenario={normalizeScenario(item)} partOptions={parts} save={(next) => patch({ ...LEGACY_KEYS, ...next })} />
      )}
    />
  )
}
