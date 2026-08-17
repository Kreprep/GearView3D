import HotspotViewer from './HotspotViewer'
import MarkdownContent from './MarkdownContent'
import { PHASE_TITLES, gaugeScore, isPhaseComplete, scenarioScore, visibleHotspotIds } from '../lib/walkAroundStep'
import './WalkAroundStep.css'

// The `walk-around` step kind: an inspection phase driven entirely by the
// step row's `data` (checks / gauges / devices / scenarios), so any equipment
// can have one and an admin can change what it asks for.
//
// Presentational only - GenericModulePage owns the saved state and passes the
// handlers, the same split the other step kinds use.

export function WalkAroundScene({
  data,
  hotspots,
  modelUrl,
  modelScale,
  modelOffsetY,
  state,
  engineStarted,
  activeScenarioId,
  selectedHotspotId,
  deviceEffect,
  defectOverlays,
  cameraPreset,
  isAdmin,
  onHotspotSelect,
  onResetView,
}) {
  const phase = data?.phase
  const isDefectStep = phase === 'defect-test'
  const activeScenario = (data?.scenarios || []).find((entry) => entry.id === activeScenarioId)

  // The defect phase swaps the whole model into a visual state instead of
  // showing markers; the other phases show the hotspots their state allows.
  const scenario = isDefectStep
    ? (activeScenario?.visualState === 'normal' ? 'good-forklift' : activeScenario?.visualState || 'good-forklift')
    : phase === 'engine-on'
      ? 'engine-on'
      : 'engine-off'

  const engineOffComplete = isPhaseComplete({ ...data, requireEngineStart: false }, state, engineStarted)

  return (
    <div className="walkaround-scene-wrap">
      <HotspotViewer
        mode={isDefectStep ? 'defect-test' : 'inspection'}
        scenario={scenario}
        activeHotspots={visibleHotspotIds(data, hotspots, { engineOffComplete, engineStarted })}
        hotspots={hotspots}
        defectOverlays={defectOverlays}
        modelUrl={modelUrl}
        modelScale={modelScale}
        modelOffsetY={modelOffsetY}
        cameraPreset={cameraPreset}
        onHotspotSelect={onHotspotSelect}
        onResetView={onResetView}
        selectedHotspotId={selectedHotspotId}
        isAdmin={isAdmin}
        deviceEffect={deviceEffect}
      />
    </div>
  )
}

function EngineOffTask({ data, state, engineStarted, onCheck, onStartEngine }) {
  const checks = data.checks || []
  const done = new Set(state.checks)
  const allChecked = checks.length > 0 && checks.every((check) => done.has(check.id))

  return (
    <>
      <p className="task-note">Click each inspection card to inspect that area and save progress.</p>
      <div className="inspection-card-grid">
        {checks.map((check) => (
          <button
            key={check.id}
            type="button"
            className={done.has(check.id) ? 'inspection-card done' : 'inspection-card'}
            onClick={() => onCheck(check)}
          >
            <span>{check.label}</span>
            <small>{check.inspect}</small>
          </button>
        ))}
      </div>
      {checks.length === 0 && <p className="task-note">This step has no inspection checks yet.</p>}
      {data.requireEngineStart && allChecked && !engineStarted && (
        <button type="button" className="start-engine-button" onClick={onStartEngine}>
          <strong>Start Engine</strong>
          <small>Walk-around complete. Turn the key here or click the ignition on the model.</small>
        </button>
      )}
    </>
  )
}

function EngineOnTask({ data, state, onGauge, onDevice }) {
  const gauges = data.gauges || []
  const devices = data.devices || []
  const done = new Set(state.devices)
  const groups = [
    ['Safety Devices', devices.filter((device) => device.group !== 'controls')],
    ['Operational Controls', devices.filter((device) => device.group === 'controls')],
  ]

  return (
    <>
      <p className="task-note">
        Read each gauge and decide if the reading is normal. Then test the devices and controls, in the panel or
        directly on the 3D model.
      </p>

      {gauges.length > 0 && (
        <div className="virtual-dashboard">
          <h4>Dashboard Indicators</h4>
          {gauges.map((gauge) => {
            const answer = state.gauges[gauge.id]
            const correct = answer === gauge.answer

            return (
              <div key={gauge.id} className={answer ? (correct ? 'gauge-card done' : 'gauge-card wrong') : 'gauge-card'}>
                <div className="gauge-dial" aria-hidden="true">
                  <i style={{ transform: `rotate(${gauge.dialAngle || 0}deg)` }} />
                </div>
                <div className="gauge-readout">
                  <span>{gauge.label}</span>
                  <strong>{gauge.reading}</strong>
                </div>
                <div className="gauge-answer-row">
                  {['Normal', 'Abnormal'].map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={answer === choice ? 'selected' : ''}
                      onClick={() => onGauge(gauge, choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                {answer && (
                  <p className={correct ? 'gauge-verdict correct' : 'gauge-verdict incorrect'}>
                    {correct ? 'Correct' : 'Re-read this gauge'}
                  </p>
                )}
              </div>
            )
          })}
          <p className="gauge-score">Gauge readings correct: {gaugeScore(data, state)}/{gauges.length}</p>
        </div>
      )}

      {groups.map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <p className="subsection-label">{label}</p>
          <div className="device-test-grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={done.has(item.id) ? 'device-test done' : 'device-test'}
                onClick={() => onDevice(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function DefectTask({ data, state, activeScenarioId, onSelectScenario, onAnswerScenario }) {
  const scenarios = data.scenarios || []
  const active = scenarios.find((entry) => entry.id === activeScenarioId) || scenarios[0]
  if (!active) return <p className="task-note">This step has no defect scenarios yet.</p>

  const savedAnswer = state.scenarios[active.id]
  const activeIndex = scenarios.findIndex((entry) => entry.id === active.id)
  // Prefer the next unanswered scenario so re-checking a wrong answer doesn't
  // just loop back to the same one; fall back to the next in order once every
  // scenario has an answer.
  const nextScenario =
    scenarios.slice(activeIndex + 1).find((entry) => !state.scenarios[entry.id]) || scenarios[activeIndex + 1]

  return (
    <>
      <div className="scenario-picker" role="tablist" aria-label="Defect recognition scenarios">
        {scenarios.map((scenario, index) => {
          const answer = state.scenarios[scenario.id]
          return (
            <button
              key={scenario.id}
              type="button"
              className={scenario.id === active.id ? 'active' : ''}
              aria-label={scenario.title}
              onClick={() => onSelectScenario(scenario.id)}
            >
              {answer ? (answer === scenario.answer ? '✓' : '✕') : index + 1}
            </button>
          )
        })}
      </div>
      <h4>{active.title}</h4>
      <p>{active.question}</p>
      <div className="scenario-choice-row">
        {(active.choices || []).map((choice) => (
          <button
            key={choice}
            type="button"
            className={savedAnswer === choice ? 'selected' : ''}
            onClick={() => onAnswerScenario(active, choice)}
          >
            {choice}
          </button>
        ))}
      </div>
      {savedAnswer && <p className="task-note">{active.feedback}</p>}
      {savedAnswer && nextScenario && (
        <button type="button" className="scenario-next-button" onClick={() => onSelectScenario(nextScenario.id)}>
          Next Scenario
        </button>
      )}
      <p className="task-note">Defect recognition score: {scenarioScore(data, state)}/{scenarios.length}</p>
    </>
  )
}

export function WalkAroundTask({ data, content, state, engineStarted, activeScenarioId, handlers }) {
  const phase = data?.phase

  return (
    <div className="walkaround-task-stack">
      {content?.body && <MarkdownContent className="walkaround-intro">{content.body}</MarkdownContent>}

      {phase === 'engine-off' && (
        <EngineOffTask
          data={data}
          state={state}
          engineStarted={engineStarted}
          onCheck={handlers.onCheck}
          onStartEngine={handlers.onStartEngine}
        />
      )}
      {phase === 'engine-on' && (
        <EngineOnTask data={data} state={state} onGauge={handlers.onGauge} onDevice={handlers.onDevice} />
      )}
      {phase === 'defect-test' && (
        <DefectTask
          data={data}
          state={state}
          activeScenarioId={activeScenarioId}
          onSelectScenario={handlers.onSelectScenario}
          onAnswerScenario={handlers.onAnswerScenario}
        />
      )}
      {!PHASE_TITLES[phase] && <p className="task-note">This step has no walk-around phase set yet.</p>}
    </div>
  )
}
