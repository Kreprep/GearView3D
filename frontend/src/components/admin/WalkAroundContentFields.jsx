import { WALK_AROUND_PHASES } from '../../data/courseDefaults'
import './WalkAroundContentFields.css'

// The editable payload of a `walk-around` step: which phase it runs and the
// list that phase asks the learner about. Everything here is `Course.data`, so
// it saves as a draft with the rest of the step and only reaches learners on
// Publish.

const PHASE_LABELS = {
  'engine-off': 'Engine-off inspection',
  'engine-on': 'Engine-on inspection',
  'defect-test': 'Defect recognition',
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `${fallback}-${Date.now()}`
}

// Every list here is edited the same way: patch one row, drop one row, or
// append a blank one.
function ListEditor({ title, note, items, onChange, emptyItem, renderFields }) {
  const patch = (index, changes) =>
    onChange(items.map((item, position) => (position === index ? { ...item, ...changes } : item)))

  return (
    <div className="walkaround-list-editor">
      <h4>{title}</h4>
      {note && <p className="admin-panel-note">{note}</p>}

      {items.map((item, index) => (
        <fieldset key={item.id || index} className="admin-fieldset">
          <legend>{item.label || item.title || `Item ${index + 1}`}</legend>
          {renderFields(item, (changes) => patch(index, changes))}
          <div className="admin-row-actions">
            <button type="button" onClick={() => onChange(items.filter((_, position) => position !== index))}>
              Remove
            </button>
          </div>
        </fieldset>
      ))}
      {items.length === 0 && <p className="admin-panel-note">Nothing here yet.</p>}

      <button type="button" className="admin-btn" onClick={() => onChange([...items, emptyItem()])}>Add</button>
    </div>
  )
}

function WalkAroundContentFields({ data, onChange }) {
  const phase = data?.phase || 'engine-off'
  const setData = (patch) => onChange({ ...data, ...patch })

  return (
    <>
      <label>
        Phase
        <select value={phase} onChange={(event) => setData({ phase: event.target.value })}>
          {WALK_AROUND_PHASES.map((value) => (
            <option key={value} value={value}>{PHASE_LABELS[value] || value}</option>
          ))}
        </select>
      </label>
      <p className="admin-panel-note">
        Each phase is its own step, so a module can have any of them in any order. The learner completes an
        engine-off step by clicking every check (and starting the engine, if required), an engine-on step by
        reading every gauge correctly and testing every device, and a defect step by answering every scenario
        correctly.
      </p>
      <p className="admin-panel-note">
        This panel decides what must be done to pass the step and the text shown for each item. A check/device&apos;s
        3D marker - its position, which phase it&apos;s visible in, and its defect-recognition behaviour - is edited
        in the Inspection Hotspots panel below, matched by the same id.
      </p>

      {phase === 'engine-off' && (
        <>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={data?.requireEngineStart !== false}
              onChange={(event) => setData({ requireEngineStart: event.target.checked })}
            />
            Require the engine to be started before this step counts as complete
          </label>

          <ListEditor
            title="Inspection checks"
            note="One card per area to inspect. The id should match the 3D hotspot it belongs to, so clicking the marker ticks the same card."
            items={data?.checks || []}
            onChange={(checks) => setData({ checks })}
            emptyItem={() => ({ id: '', label: 'New check', targetArea: '', inspect: '', found: '', status: 'safe', feedback: '' })}
            renderFields={(item, patch) => (
              <>
                <label>Label<input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'check') })} /></label>
                <label>Hotspot id<input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} /></label>
                <label>Target area<input value={item.targetArea || ''} onChange={(event) => patch({ targetArea: event.target.value })} /></label>
                <label>
                  What to inspect (shown before the learner clicks this check)
                  <textarea rows={2} value={item.inspect || ''} onChange={(event) => patch({ inspect: event.target.value })} />
                </label>
                <label>What the learner finds<textarea rows={2} value={item.found || ''} onChange={(event) => patch({ found: event.target.value })} /></label>
                <label>Feedback line<textarea rows={2} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} /></label>
                <label>
                  Condition
                  <select value={item.status || 'safe'} onChange={(event) => patch({ status: event.target.value })}>
                    <option value="safe">Safe - shown as a normal finding</option>
                    <option value="unsafe">Unsafe - shown as a warning</option>
                  </select>
                </label>
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
                <label>Label<input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'gauge') })} /></label>
                <label>Id<input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} /></label>
                <label>Reading<input value={item.reading || ''} onChange={(event) => patch({ reading: event.target.value })} /></label>
                <label>Dial angle (degrees)<input type="number" value={item.dialAngle ?? 0} onChange={(event) => patch({ dialAngle: Number(event.target.value) })} /></label>
                <label>
                  Image URL (optional - reference photo shown in Part Details when clicked)
                  <input value={item.image || ''} onChange={(event) => patch({ image: event.target.value })} />
                </label>
                <label>
                  Correct answer
                  <select value={item.answer || 'Normal'} onChange={(event) => patch({ answer: event.target.value })}>
                    <option value="Normal">Normal</option>
                    <option value="Abnormal">Abnormal</option>
                  </select>
                </label>
                <label>Feedback when right<textarea rows={2} value={item.correctFeedback || ''} onChange={(event) => patch({ correctFeedback: event.target.value })} /></label>
                <label>Feedback when wrong<textarea rows={2} value={item.incorrectFeedback || ''} onChange={(event) => patch({ incorrectFeedback: event.target.value })} /></label>
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
                <label>Label<input value={item.label || ''} onChange={(event) => patch({ label: event.target.value, id: item.id || slugify(event.target.value, 'device') })} /></label>
                <label>Hotspot id<input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} /></label>
                <label>Feedback line<textarea rows={2} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} /></label>
                <label>
                  Group
                  <select value={item.group || 'safety'} onChange={(event) => patch({ group: event.target.value })}>
                    <option value="safety">Safety devices</option>
                    <option value="controls">Operational controls</option>
                  </select>
                </label>
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
              <label>Title<input value={item.title || ''} onChange={(event) => patch({ title: event.target.value, id: item.id || slugify(event.target.value, 'scenario') })} /></label>
              <label>Id<input value={item.id || ''} onChange={(event) => patch({ id: event.target.value })} /></label>
              <label>Visual state<input value={item.visualState || ''} placeholder="normal / oil-leak / flat-tire" onChange={(event) => patch({ visualState: event.target.value })} /></label>
              <p className="admin-panel-note">Matches a defect overlay on the 3D model; &quot;normal&quot; shows the equipment with no defect.</p>
              <label>Question<textarea rows={2} value={item.question || ''} onChange={(event) => patch({ question: event.target.value })} /></label>
              <label>Choices (one per line)
                <textarea
                  rows={2}
                  value={(item.choices || []).join('\n')}
                  onChange={(event) => patch({ choices: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
                />
              </label>
              <label>Correct answer<input value={item.answer || ''} onChange={(event) => patch({ answer: event.target.value })} /></label>
              <label>Feedback<textarea rows={3} value={item.feedback || ''} onChange={(event) => patch({ feedback: event.target.value })} /></label>
            </>
          )}
        />
      )}
    </>
  )
}

export default WalkAroundContentFields
