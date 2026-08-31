import { WALK_AROUND_PHASES } from '../../data/courseDefaults'
import { slugify as toSlug } from '../../lib/slug'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select, Checkbox } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

// The editable payload of a `walk-around` step: which phase it runs and the
// list that phase asks the learner about. Everything here is `Course.data`, so
// it saves as a draft with the rest of the step and only reaches learners on
// Publish.

const PHASE_LABELS = {
  'engine-off': 'Engine-off inspection',
  'engine-on': 'Engine-on inspection',
  'defect-test': 'Defect recognition',
}

// These ids are derived client-side (no server round trip to dedupe them
// against, unlike the admin.js routes' equivalent), so an empty slug falls
// back to a timestamped placeholder rather than an empty string.
function slugify(value, fallback) {
  return toSlug(value) || `${fallback}-${Date.now()}`
}

// Every list here is edited the same way: patch one row, drop one row, or
// append a blank one.
function ListEditor({ title, note, items, onChange, emptyItem, renderFields }) {
  const patch = (index, changes) =>
    onChange(items.map((item, position) => (position === index ? { ...item, ...changes } : item)))

  return (
    <div className="mt-4 grid gap-2.5 border-t border-slate-200 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h4 className="m-0 text-sm font-extrabold text-ink">{title}</h4>
      {note && <PanelNote>{note}</PanelNote>}

      {items.map((item, index) => (
        <fieldset
          key={item.id || index}
          className="m-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4"
        >
          <legend className="px-1 text-[13px] font-bold text-body">
            {item.label || item.title || `Item ${index + 1}`}
          </legend>
          {renderFields(item, (changes) => patch(index, changes))}
          <Toolbar className="col-span-full">
            <Button type="button" size="sm" variant="danger" onClick={() => onChange(items.filter((_, position) => position !== index))}>
              Remove
            </Button>
          </Toolbar>
        </fieldset>
      ))}
      {items.length === 0 && <PanelNote>Nothing here yet.</PanelNote>}

      <Button type="button" variant="secondary" className="justify-self-start" onClick={() => onChange([...items, emptyItem()])}>Add</Button>
    </div>
  )
}

function WalkAroundContentFields({ data, onChange }) {
  const phase = data?.phase || 'engine-off'
  const setData = (patch) => onChange({ ...data, ...patch })

  return (
    <>
      <Field label="Phase">
        <Select value={phase} onChange={(event) => setData({ phase: event.target.value })}>
          {WALK_AROUND_PHASES.map((value) => (
            <option key={value} value={value}>{PHASE_LABELS[value] || value}</option>
          ))}
        </Select>
      </Field>
      <PanelNote className="mt-2">
        Each phase is its own step, so a module can have any of them in any order. The learner completes an
        engine-off step by clicking every check (and starting the engine, if required), an engine-on step by
        reading every gauge correctly and testing every device, and a defect step by answering every scenario
        correctly.
      </PanelNote>
      <PanelNote className="mt-2">
        This panel decides what must be done to pass the step and the text shown for each item. A check/device&apos;s
        3D marker - its position, which phase it&apos;s visible in, and its defect-recognition behaviour - is edited
        in the Inspection Hotspots panel below, matched by the same id.
      </PanelNote>

      {phase === 'engine-off' && (
        <>
          <Checkbox
            className="mt-3"
            label="Require the engine to be started before this step counts as complete"
            checked={data?.requireEngineStart !== false}
            onChange={(event) => setData({ requireEngineStart: event.target.checked })}
          />

          <ListEditor
            title="Inspection checks"
            note="One card per area to inspect. The id should match the 3D hotspot it belongs to, so clicking the marker ticks the same card."
            items={data?.checks || []}
            onChange={(checks) => setData({ checks })}
            emptyItem={() => ({ id: '', label: 'New check', targetArea: '', inspect: '', found: '', status: 'safe', feedback: '' })}
            renderFields={(item, patch) => (
              <>
                <Field label="Label">
                  <Input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'check') })} />
                </Field>
                <Field label="Hotspot id">
                  <Input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} />
                </Field>
                <Field label="Target area">
                  <Input value={item.targetArea || ''} onChange={(event) => patch({ targetArea: event.target.value })} />
                </Field>
                <Field label="What to inspect (shown before the learner clicks this check)" className="col-span-full">
                  <Textarea rows={2} value={item.inspect || ''} onChange={(event) => patch({ inspect: event.target.value })} />
                </Field>
                <Field label="What the learner finds" className="col-span-full">
                  <Textarea rows={2} value={item.found || ''} onChange={(event) => patch({ found: event.target.value })} />
                </Field>
                <Field label="Feedback line" className="col-span-full">
                  <Textarea rows={2} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} />
                </Field>
                <Field label="Condition">
                  <Select value={item.status || 'safe'} onChange={(event) => patch({ status: event.target.value })}>
                    <option value="safe">Safe - shown as a normal finding</option>
                    <option value="unsafe">Unsafe - shown as a warning</option>
                  </Select>
                </Field>
              </>
            )}
          />
        </>
      )}

      {phase === 'engine-on' && (
        <>
          <ListEditor
            title="Dashboard gauges"
            note="The learner judges each reading. Only a correct call counts toward completing the step."
            items={data?.gauges || []}
            onChange={(gauges) => setData({ gauges })}
            emptyItem={() => ({ id: '', label: 'New gauge', reading: '', dialAngle: 0, answer: 'Normal', image: '', correctFeedback: '', incorrectFeedback: '' })}
            renderFields={(item, patch) => (
              <>
                <Field label="Label">
                  <Input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'gauge') })} />
                </Field>
                <Field label="Id">
                  <Input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} />
                </Field>
                <Field label="Reading">
                  <Input value={item.reading || ''} onChange={(event) => patch({ reading: event.target.value })} />
                </Field>
                <Field label="Dial angle (degrees)">
                  <Input type="number" value={item.dialAngle ?? 0} onChange={(event) => patch({ dialAngle: Number(event.target.value) })} />
                </Field>
                <Field label="Image URL (optional - reference photo shown in Part Details when clicked)" className="col-span-full">
                  <Input value={item.image || ''} onChange={(event) => patch({ image: event.target.value })} />
                </Field>
                <Field label="Correct answer">
                  <Select value={item.answer || 'Normal'} onChange={(event) => patch({ answer: event.target.value })}>
                    <option value="Normal">Normal</option>
                    <option value="Abnormal">Abnormal</option>
                  </Select>
                </Field>
                <Field label="Feedback when right" className="col-span-full">
                  <Textarea rows={2} value={item.correctFeedback || ''} onChange={(event) => patch({ correctFeedback: event.target.value })} />
                </Field>
                <Field label="Feedback when wrong" className="col-span-full">
                  <Textarea rows={2} value={item.incorrectFeedback || ''} onChange={(event) => patch({ incorrectFeedback: event.target.value })} />
                </Field>
              </>
            )}
          />

          <ListEditor
            title="Device and control tests"
            note="Clicking the button - or the matching 3D marker - counts the test. Safety devices and operational controls are shown as two groups."
            items={data?.devices || []}
            onChange={(devices) => setData({ devices })}
            emptyItem={() => ({ id: '', label: 'New test', feedback: '', group: 'safety' })}
            renderFields={(item, patch) => (
              <>
                <Field label="Label">
                  <Input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'device') })} />
                </Field>
                <Field label="Hotspot id">
                  <Input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} />
                </Field>
                <Field label="Feedback line" className="col-span-full">
                  <Textarea rows={2} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} />
                </Field>
                <Field label="Group">
                  <Select value={item.group || 'safety'} onChange={(event) => patch({ group: event.target.value })}>
                    <option value="safety">Safety devices</option>
                    <option value="controls">Operational controls</option>
                  </Select>
                </Field>
              </>
            )}
          />
        </>
      )}

      {phase === 'defect-test' && (
        <ListEditor
          title="Defect scenarios"
          note="Each scenario puts the model into a visual state and asks one question. The learner must answer every one correctly."
          items={data?.scenarios || []}
          onChange={(scenarios) => setData({ scenarios })}
          emptyItem={() => ({
            id: '',
            title: 'New scenario',
            visualState: 'normal',
            question: 'Is this equipment usable for operation?',
            choices: ['Yes', 'No'],
            answer: 'No',
            feedback: '',
          })}
          renderFields={(item, patch) => (
            <>
              <Field label="Title">
                <Input value={item.title || ''} onChange={(event) => patch({ title: event.target.value, id: item.id || slugify(event.target.value, 'scenario') })} />
              </Field>
              <Field label="Id">
                <Input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} />
              </Field>
              <Field label="Visual state" className="col-span-full">
                <Input value={item.visualState || ''} placeholder="normal / oil-leak / flat-tire" onChange={(event) => patch({ visualState: event.target.value })} />
              </Field>
              <PanelNote className="col-span-full">Matches a defect overlay on the 3D model; &quot;normal&quot; shows the equipment with no defect.</PanelNote>
              <Field label="Question" className="col-span-full">
                <Textarea rows={2} value={item.question || ''} onChange={(event) => patch({ question: event.target.value })} />
              </Field>
              <Field label="Choices (one per line)" className="col-span-full">
                <Textarea
                  rows={2}
                  value={(item.choices || []).join('\n')}
                  onChange={(event) => patch({ choices: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="Correct answer">
                <Input value={item.answer || ''} onChange={(event) => patch({ answer: event.target.value })} />
              </Field>
              <Field label="Feedback" className="col-span-full">
                <Textarea rows={3} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} />
              </Field>
              <Field label="Demo animation id (optional)">
                <Input value={item.deviceEffectId || ''} placeholder="brakes / steering-response / lift-tilt-functions / forward-reverse-travel" onChange={(event) => patch({ deviceEffectId: event.target.value })} />
              </Field>
              <Field label="Demo button label">
                <Input value={item.demoLabel || ''} placeholder="Play demo" onChange={(event) => patch({ demoLabel: event.target.value })} />
              </Field>
              <PanelNote className="col-span-full">
                Adds a &quot;Play demo&quot; button that plays that Engine-On device animation on the model, for scenarios
                that are a behavior rather than a visible defect (e.g. a working brake test). Leave blank for
                scenarios with no demo.
              </PanelNote>
            </>
          )}
        />
      )}
    </>
  )
}

export default WalkAroundContentFields
