import { WALK_AROUND_PHASES } from '../../data/courseDefaults'
import { deviceDetector, DETECTOR_IDS } from '../../lib/inspection/detectors'
import { DEFAULT_FAULT_RAMP_S, FAULT_TRIGGERS, gaugeFault, gaugeInstrument, INSTRUMENT_IDS, INSTRUMENTS } from '../../lib/inspection/instruments'
import { slugify as toSlug } from '../../lib/slug'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select, Checkbox } from '../ui/input'
import { DefectScenarioFields } from './DefectScenarioFields'
import { ListEditor } from './ListEditor'

// The editable payload of a `walk-around` step: which phase it runs and the
// list that phase asks the learner about. Everything here is `Course.data`, so
// it saves as a draft with the rest of the step and only reaches learners on
// Publish.

const PHASE_LABELS = {
  'engine-off': 'Engine-off inspection',
  'engine-on': 'Engine-on inspection',
  'defect-test': 'Defect recognition',
}

// The cab's instruments (lib/inspection/instruments.js) and device tests
// (lib/inspection/detectors.js), as the admin picks them.
const INSTRUMENT_LABELS = {
  lamps: 'Warning lamp row (judged on the bulb check)',
  'lamp.charge': 'Charge lamp',
  'lamp.oil': 'Oil pressure lamp',
  'lamp.seatbelt': 'Seatbelt lamp',
  'lamp.parkingBrake': 'Parking brake lamp',
  'gauge.fuel': 'Fuel gauge',
  'gauge.temp': 'Coolant temperature gauge',
  hours: 'Hour meter',
}

const DETECTOR_LABELS = {
  marker: 'Click its 3D marker',
  'lit-marker': 'Lights on, then click its 3D marker',
  horn: 'Sound the horn',
  lights: 'Switch the lights on',
  beacon: 'Switch the beacon on',
  'turn-signals': 'Signal left and right',
  'backup-alarm': 'Engine running, lever in R (backup alarm)',
  'steer-lock': 'Full steering lock both ways',
  'brake-test': 'Creep past 2 km/h, then brake to a stop within 2 m',
  'lift-tilt': 'Raise and lower the forks, tilt fully back and forward',
  travel: 'Drive 0.5 m forward and 0.5 m in reverse',
}

// A select over `ids` whose first option, "Default", stands for the field
// left out, which falls back to the stock map.
function DefaultSelect({ value, ids, labels, defaultLabel, onChange }) {
  return (
    <Select value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
      <option value="">{defaultLabel}</option>
      {ids.map((id) => (
        <option key={id} value={id}>{labels[id] || id}</option>
      ))}
    </Select>
  )
}

const FAULT_KIND_LABELS = {
  none: 'None: reads true',
  'stays-lit': 'Lamp stays lit',
  dead: 'Lamp never lights (dead bulb)',
  needle: 'Needle moves to a reading',
}

// What a gauge's instrument shows in the cab. Left out, a stock gauge whose
// answer is Abnormal reads its stock fault (gaugeFault()); null reads true.
function FaultFields({ gauge, patch }) {
  const instrument = gaugeInstrument(gauge)
  if (!instrument) return null
  const isGauge = INSTRUMENTS[instrument].kind === 'gauge'
  const fault = gauge.fault
  const kind = fault === undefined ? 'default' : fault === null ? 'none' : isGauge ? 'needle' : fault.lamp
  const kinds = ['none', ...(isGauge ? ['needle'] : ['stays-lit', 'dead'])]
  const stock = gaugeFault({ ...gauge, fault: undefined })
  const setKind = (next) => {
    if (next === 'default') patch({ fault: undefined })
    else if (next === 'none') patch({ fault: null })
    else if (next === 'needle') patch({ fault: { value: 0.95, after: 'start', rampS: DEFAULT_FAULT_RAMP_S } })
    else patch({ fault: { lamp: next } })
  }

  return (
    <>
      <Field label="What the instrument shows">
        <Select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="default">{`Default (${stock ? 'the stock fault' : 'reads true'})`}</option>
          {kinds.map((id) => (
            <option key={id} value={id}>{FAULT_KIND_LABELS[id]}</option>
          ))}
        </Select>
      </Field>
      {kind === 'needle' && (
        <>
          <Field label="Reading it moves to, % (0 empty or cold, 100 full or hot)">
            <Input
              type="number"
              min={0}
              max={100}
              value={Math.round((fault.value ?? 0) * 100)}
              onChange={(event) => patch({ fault: { ...fault, value: Math.min(Math.max(Number(event.target.value) / 100, 0), 1) } })}
            />
          </Field>
          <Field label="Starting from">
            <Select value={fault.after || 'start'} onChange={(event) => patch({ fault: { ...fault, after: event.target.value } })}>
              {FAULT_TRIGGERS.map((trigger) => (
                <option key={trigger} value={trigger}>{trigger === 'start' ? 'Engine start' : 'Key ON'}</option>
              ))}
            </Select>
          </Field>
          <Field label="Over (seconds)">
            <Input
              type="number"
              min={0}
              value={fault.rampS ?? DEFAULT_FAULT_RAMP_S}
              onChange={(event) => patch({ fault: { ...fault, rampS: Math.max(Number(event.target.value), 0) } })}
            />
          </Field>
        </>
      )}
    </>
  )
}

// These ids are derived client-side (no server round trip to dedupe them
// against, unlike the admin.js routes' equivalent), so an empty slug falls
// back to a timestamped placeholder rather than an empty string.
function slugify(value, fallback) {
  return toSlug(value) || `${fallback}-${Date.now()}`
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
        engine-off step by clicking every check (and starting the engine, if required), an engine-on step in the
        forklift&apos;s cab by starting it (if required), judging every gauge correctly and doing every device test,
        and a defect step by answering every scenario correctly (the first answer to each is its score).
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
          <Checkbox
            className="mt-3"
            label="Require the engine to be started in the cab during this step"
            checked={data?.requireEngineStart === true}
            onChange={(event) => setData({ requireEngineStart: event.target.checked })}
          />

          <ListEditor
            title="Dashboard gauges"
            note="The learner judges each reading, and only a correct call counts. A gauge on a dashboard instrument is judged by clicking that instrument in the cab; one with no instrument is a card in the task panel, showing its reading and dial angle."
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
                <Field label="Dashboard instrument">
                  <DefaultSelect
                    value={item.instrument}
                    ids={INSTRUMENT_IDS}
                    labels={INSTRUMENT_LABELS}
                    defaultLabel={`Default (${INSTRUMENT_LABELS[gaugeInstrument({ id: item.id })] || 'a card in the task panel'})`}
                    onChange={(instrument) => patch({ instrument, fault: undefined })}
                  />
                </Field>
                <FaultFields gauge={item} patch={patch} />
                <PanelNote className="col-span-full">
                  An Abnormal answer needs a fault the learner can see on the instrument: a lamp that stays lit or
                  never lights, or a needle that moves out of its normal band.
                </PanelNote>
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
            note="Each test ticks itself when the learner is seen doing it in the cab. Safety devices and operational controls are shown as two groups."
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
                <Field label="How it is tested">
                  <DefaultSelect
                    value={item.detect}
                    ids={DETECTOR_IDS}
                    labels={DETECTOR_LABELS}
                    defaultLabel={`Default (${DETECTOR_LABELS[deviceDetector({ id: item.id })]})`}
                    onChange={(detect) => patch({ detect })}
                  />
                </Field>
              </>
            )}
          />
        </>
      )}

      {phase === 'defect-test' && (
        <DefectScenarioFields scenarios={data?.scenarios || []} onChange={(scenarios) => setData({ scenarios })} />
      )}
    </>
  )
}

export default WalkAroundContentFields
