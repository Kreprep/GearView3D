import HotspotViewer from './HotspotViewer'
import MarkdownContent from './MarkdownContent'
import { AudioControl } from './AudioControl'
import { useT } from '../i18n'
import { PHASE_TITLE_KEYS, gaugeScore, isPhaseComplete, scenarioScore, visibleHotspotIds } from '../lib/walkAroundStep'
import './WalkAroundStep.css'

// The gauge choices, as a value/label pair rather than one string doing both
// jobs. `value` is what gets written into the learner's saved progress and
// compared against `gauge.answer`, which is admin-authored English content in
// the database - translating it would silently mark every correct answer wrong
// the moment a learner switched language. Only `labelKey` is translated.

// The `walk-around` step kind: an inspection phase driven entirely by the
// step row's `data` (checks / gauges / devices / scenarios), so any equipment
// can have one and an admin can change what it asks for.
//
// Presentational only - GenericModulePage owns the saved state and passes the
// handlers, the same split the other step kinds use.

export function WalkAroundScene({
  data,
  hotspots,
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

const GAUGE_CHOICES = [
  { value: 'Normal', labelKey: 'walkAround.gauges.normal' },
  { value: 'Abnormal', labelKey: 'walkAround.gauges.abnormal' },
]

function EngineOffTask({ data, state, engineStarted, onCheck, onStartEngine }) {
  const t = useT()
  const checks = data.checks || []
  const done = new Set(state.checks)
  const allChecked = checks.length > 0 && checks.every((check) => done.has(check.id))

  return (
    <>
      <p className="task-note">{t('walkAround.checks.intro')}</p>
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
      {checks.length === 0 && <p className="task-note">{t('walkAround.checks.empty')}</p>}
      {data.requireEngineStart && allChecked && !engineStarted && (
        <button type="button" className="start-engine-button" onClick={onStartEngine}>
          <strong>{t('walkAround.startEngine')}</strong>
          <small>{t('walkAround.startEngineHint')}</small>
        </button>
      )}
    </>
  )
}

function EngineOnTask({ data, state, onGauge, onDevice }) {
  const t = useT()
  const gauges = data.gauges || []
  const devices = data.devices || []
  const done = new Set(state.devices)
  const groups = [
    ['walkAround.devices.safety', devices.filter((device) => device.group !== 'controls')],
    ['walkAround.devices.controls', devices.filter((device) => device.group === 'controls')],
  ]

  return (
    <>
      {gauges.length > 0 && (
        <div className="virtual-dashboard">
          <h4>{t('walkAround.gauges.heading')}</h4>
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
                  {GAUGE_CHOICES.map(({ value, labelKey }) => (
                    <button
                      key={value}
                      type="button"
                      className={answer === value ? 'selected' : ''}
                      onClick={() => onGauge(gauge, value)}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
                {answer && (
                  <p className={correct ? 'gauge-verdict correct' : 'gauge-verdict incorrect'}>
                    {t(correct ? 'walkAround.gauges.correct' : 'walkAround.gauges.reread')}
                  </p>
                )}
              </div>
            )
          })}
          <p className="gauge-score">
            {t('walkAround.gauges.score', { correct: gaugeScore(data, state), total: gauges.length })}
          </p>
        </div>
      )}

      {groups.map(([labelKey, items]) => items.length > 0 && (
        <div key={labelKey}>
          <p className="subsection-label">{t(labelKey)}</p>
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

function DefectTask({ data, state, activeScenarioId, onSelectScenario, onAnswerScenario, onPlayDemo }) {
  const t = useT()
  const scenarios = data.scenarios || []
  const active = scenarios.find((entry) => entry.id === activeScenarioId) || scenarios[0]
  if (!active) return <p className="task-note">{t('walkAround.defects.empty')}</p>

  const savedAnswer = state.scenarios[active.id]
  const activeIndex = scenarios.findIndex((entry) => entry.id === active.id)
  // Prefer the next unanswered scenario so re-checking a wrong answer doesn't
  // just loop back to the same one; fall back to the next in order once every
  // scenario has an answer.
  const nextScenario =
    scenarios.slice(activeIndex + 1).find((entry) => !state.scenarios[entry.id]) || scenarios[activeIndex + 1]

  return (
    <>
      <div className="scenario-picker" role="tablist" aria-label={t('walkAround.defects.pickerLabel')}>
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
      {active.deviceEffectId && (
        <button type="button" className="scenario-demo-button" onClick={() => onPlayDemo(active)}>
          {active.demoLabel || t('walkAround.defects.playDemo')}
        </button>
      )}
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
          {t('walkAround.defects.next')}
        </button>
      )}
      <p className="task-note">
        {t('walkAround.defects.score', { correct: scenarioScore(data, state), total: scenarios.length })}
      </p>
    </>
  )
}

export function WalkAroundTask({ data, content, state, engineStarted, activeScenarioId, handlers }) {
  const t = useT()
  const phase = data?.phase

  return (
    <div className="walkaround-task-stack">
      {/* The device tests and the engine start are heard, and the volume is
          shared with the driving simulation's dashboard. */}
      {PHASE_TITLE_KEYS[phase] && (
        <div className="walkaround-audio">
          <AudioControl tone="panel" />
        </div>
      )}
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
          onPlayDemo={handlers.onPlayDemo}
        />
      )}
      {!PHASE_TITLE_KEYS[phase] && <p className="task-note">{t('walkAround.noPhase')}</p>}
    </div>
  )
}
