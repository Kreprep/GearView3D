import { useMemo } from 'react'
import HotspotViewer from './HotspotViewer'
import MarkdownContent from './MarkdownContent'
import { AudioControl } from './AudioControl'
import { useT } from '../i18n'
import { exteriorEffects } from '../data/defectLibrary'
import { deviceDetector } from '../lib/inspection/detectors'
import { instrumentReadyAt } from '../lib/inspection/instruments'
import {
  engineOnGauges,
  firstAnswerScore,
  GAUGE_CHOICES,
  gaugeScore,
  gaugeStatus,
  isPhaseComplete,
  isScenarioCorrect,
  locateCandidates,
  NO_CAB_STATUS,
  PHASE_TITLE_KEYS,
  QUESTION_PROMPT_KEYS,
  scenarioScore,
  USABLE_CHOICES,
  visibleHotspotIds,
} from '../lib/walkAroundStep'
import './WalkAroundStep.css'

// The `walk-around` step kind: an inspection phase driven entirely by the
// step row's `data` (checks / gauges / devices / scenarios), so any equipment
// can have one and an admin can change what it asks for.
//
// Presentational only - GenericModulePage owns the saved state and passes the
// handlers, the same split the other step kinds use.

// The exterior walk-around scene. Engine-off shows the hotspots its state
// allows. A defect test's exterior scenario (`scenario`, normalized: lib/
// walkAroundStep.js) puts its defects on the model and shows no markers,
// except a locate question's unlabelled ones; `onLocate(hotspot)` takes the
// click. (The engine-on phase and cab scenarios are the cab's,
// components/inspection/CabInspectionViewer.jsx.)
export function WalkAroundScene({
  data,
  hotspots,
  state,
  engineStarted,
  scenario,
  selectedHotspotId,
  deviceEffect,
  cameraPreset,
  isAdmin,
  onHotspotSelect,
  onLocate,
  onResetView,
}) {
  const t = useT()
  const isDefectStep = data?.phase === 'defect-test'
  const defects = useMemo(() => (isDefectStep && scenario ? exteriorEffects(scenario.defects) : null), [isDefectStep, scenario])
  const locate = isDefectStep && scenario?.question.type === 'locate'
    ? {
        hotspots: locateCandidates(hotspots),
        labelFor: (_, index) => t('walkAround.defects.locate.marker', { n: index + 1 }),
        selectedId: state.scenarios?.[scenario.id] ?? null,
        onPick: onLocate,
      }
    : null

  const engineOffComplete = isPhaseComplete({ ...data, requireEngineStart: false }, state, engineStarted)

  return (
    <div className="walkaround-scene-wrap">
      <HotspotViewer
        // A new scenario is a new forklift: the view starts over.
        key={isDefectStep ? scenario?.id : 'inspection'}
        defects={defects}
        locate={locate}
        activeHotspots={visibleHotspotIds(data, hotspots, { engineOffComplete, engineStarted })}
        hotspots={hotspots}
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

// One item of the checklist: a tick when done, said aloud as well.
function CheckRow({ done, label, detail }) {
  const t = useT()
  return (
    <li className={done ? 'cab-check done' : 'cab-check'}>
      <span className="cab-check-mark" aria-hidden="true">{done ? '✓' : ''}</span>
      <span className="cab-check-body">
        <span>
          {label}
          <span className="sr-only"> ({t(done ? 'walkAround.cab.status.done' : 'walkAround.cab.status.notDone')})</span>
        </span>
        {detail && <small>{detail}</small>}
      </span>
    </li>
  )
}

// A gauge judged from a card here rather than on the dashboard: one whose row
// names no instrument the dashboard has (an admin-made gauge).
function GaugeCard({ gauge, answer, onGauge }) {
  const t = useT()
  const correct = answer === gauge.answer
  return (
    <div className={answer ? (correct ? 'gauge-card done' : 'gauge-card wrong') : 'gauge-card'}>
      <div className="gauge-dial" aria-hidden="true">
        <i style={{ transform: `rotate(${gauge.dialAngle || 0}deg)` }} />
      </div>
      <div className="gauge-readout">
        <span>{gauge.label}</span>
        <strong>{gauge.reading}</strong>
      </div>
      <div className="gauge-answer-row">
        {GAUGE_CHOICES.map(({ value, labelKey }) => (
          <button key={value} type="button" className={answer === value ? 'selected' : ''} onClick={() => onGauge(gauge, value)}>
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
}

// The engine-on step's checklist, in the cab (docs/modules/
// module-improvements-plan.md, 3.3): start-up, read live from the cab;
// instruments, judged on the dashboard's judge popover (or a card here for
// a gauge with no instrument); devices and controls, ticked by the
// inspection monitor as the learner does each test.
function EngineOnTask({ data, state, cab, onGauge }) {
  const t = useT()
  const devices = data.devices || []
  const tested = new Set(state.devices)
  const { dashboard, cards } = engineOnGauges(data)
  const waitingForKey = dashboard.some(({ instrument }) => instrumentReadyAt(instrument) === 'key') && !cab.keyOn
  const waitingForStart = dashboard.some(({ instrument }) => instrumentReadyAt(instrument) === 'start') && !cab.engineRan
  const groups = [
    ['walkAround.devices.safety', devices.filter((device) => device.group !== 'controls')],
    ['walkAround.devices.controls', devices.filter((device) => device.group === 'controls')],
  ]
  const verdict = (gauge) => {
    const status = gaugeStatus(gauge, state)
    if (status === 'pending') return t('walkAround.cab.status.pending')
    return status === 'correct' ? gauge.correctFeedback || t('walkAround.gauges.correct') : gauge.incorrectFeedback || t('walkAround.gauges.reread')
  }

  return (
    <>
      <p className="subsection-label">{t('walkAround.cab.startup')}</p>
      <ul className="cab-checklist">
        <CheckRow done={cab.seatbelt || cab.engineOn} label={t('walkAround.cab.startup.seatbelt')} />
        <CheckRow done={cab.parkingBrake || cab.engineOn} label={t('walkAround.cab.startup.parkingBrake')} />
        <CheckRow done={cab.neutral || cab.engineOn} label={t('walkAround.cab.startup.neutral')} />
        <CheckRow done={cab.keyOn} label={t('walkAround.cab.startup.keyOn')} />
        <CheckRow
          done={cab.engineOn}
          label={t('walkAround.cab.startup.start')}
          detail={cab.engineOn ? t('walkAround.cab.startup.started') : null}
        />
      </ul>

      {data.gauges?.length > 0 && (
        <>
          <p className="subsection-label">{t('walkAround.cab.instruments')}</p>
          {dashboard.length > 0 && (
            <>
              <p className="task-note">{t('walkAround.cab.instruments.hint')}</p>
              {waitingForKey && <p className="task-note">{t('walkAround.cab.instruments.waitKey')}</p>}
              {!waitingForKey && waitingForStart && <p className="task-note">{t('walkAround.cab.instruments.waitStart')}</p>}
              <ul className="cab-checklist">
                {dashboard.map(({ gauge }) => (
                  <CheckRow key={gauge.id} done={gaugeStatus(gauge, state) === 'correct'} label={gauge.label} detail={verdict(gauge)} />
                ))}
              </ul>
            </>
          )}
          {cards.length > 0 && (
            <div className="virtual-dashboard">
              <h4>{t('walkAround.cab.instruments.cards')}</h4>
              {cards.map((gauge) => (
                <GaugeCard key={gauge.id} gauge={gauge} answer={state.gauges[gauge.id]} onGauge={onGauge} />
              ))}
            </div>
          )}
          <p className="task-note">
            {t('walkAround.gauges.score', { correct: gaugeScore(data, state), total: data.gauges.length })}
          </p>
        </>
      )}

      {groups.map(([labelKey, items]) => items.length > 0 && (
        <div key={labelKey}>
          <p className="subsection-label">{t(labelKey)}</p>
          <ul className="cab-checklist">
            {items.map((device) => (
              <CheckRow
                key={device.id}
                done={tested.has(device.id)}
                label={device.label}
                detail={tested.has(device.id) ? device.feedback : t(`walkAround.cab.detect.${deviceDetector(device)}`)}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

// The answer controls for one scenario's question. Usable is Yes / No with
// translated labels over English values; identify and action are the admin's
// own choices; locate is answered on the model.
function ScenarioAnswers({ scenario, answer, onAnswer }) {
  const t = useT()
  const { type, choices } = scenario.question
  if (type === 'locate') return <p className="task-note">{t('walkAround.defects.locate.hint')}</p>

  const options = type === 'usable'
    ? USABLE_CHOICES.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))
    : choices.map((choice) => ({ value: choice, label: choice }))
  return (
    <div className={type === 'usable' ? 'scenario-choice-row' : 'scenario-choice-list'}>
      {options.map(({ value, label }) => (
        <button key={value} type="button" className={answer === value ? 'selected' : ''} aria-pressed={answer === value} onClick={() => onAnswer(scenario, value)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// The defect test (docs/modules/module-improvements-plan.md, 3.4).
// `scenarios` are normalized and in the learner's order; titles are
// generated ("Forklift 3 of 10") so a title cannot give an answer away.
function DefectTask({ data, scenarios, state, activeScenarioId, onSelectScenario, onAnswerScenario, onPlayDemo }) {
  const t = useT()
  const activeIndex = Math.max(scenarios.findIndex((entry) => entry.id === activeScenarioId), 0)
  const active = scenarios[activeIndex]
  if (!active) return <p className="task-note">{t('walkAround.defects.empty')}</p>

  const savedAnswer = state.scenarios[active.id]
  const answered = savedAnswer !== undefined
  const correct = isScenarioCorrect(active, savedAnswer)
  // Prefer the next unanswered scenario so re-checking a wrong answer doesn't
  // just loop back to the same one; fall back to the next in order once every
  // scenario has an answer.
  const nextScenario =
    scenarios.slice(activeIndex + 1).find((entry) => state.scenarios[entry.id] === undefined) || scenarios[activeIndex + 1]
  const first = firstAnswerScore(data, state)
  const total = scenarios.length
  const statusKey = (scenario) => {
    const answer = state.scenarios[scenario.id]
    if (answer === undefined) return 'walkAround.cab.status.notDone'
    return isScenarioCorrect(scenario, answer) ? 'walkAround.cab.status.done' : 'walkAround.defects.status.wrong'
  }

  return (
    <>
      <div className="scenario-picker" role="tablist" aria-label={t('walkAround.defects.pickerLabel')}>
        {scenarios.map((scenario, index) => {
          const answer = state.scenarios[scenario.id]
          return (
            <button
              key={scenario.id}
              type="button"
              role="tab"
              aria-selected={scenario.id === active.id}
              className={scenario.id === active.id ? 'active' : ''}
              aria-label={`${t('walkAround.defects.title', { n: index + 1, total })} (${t(statusKey(scenario))})`}
              onClick={() => onSelectScenario(scenario.id)}
            >
              {answer === undefined ? index + 1 : isScenarioCorrect(scenario, answer) ? '✓' : '✕'}
            </button>
          )
        })}
      </div>
      <h4>{t('walkAround.defects.title', { n: activeIndex + 1, total })}</h4>
      {active.view === 'cab' && <p className="task-note">{t('walkAround.defects.cab')}</p>}
      <p>{active.question.prompt || t(QUESTION_PROMPT_KEYS[active.question.type])}</p>
      {active.demo && (
        <button type="button" className="scenario-demo-button" onClick={() => onPlayDemo(active)}>
          {t('walkAround.defects.playDemo')}
        </button>
      )}
      <ScenarioAnswers scenario={active} answer={savedAnswer} onAnswer={onAnswerScenario} />
      {answered && (
        <p className={correct ? 'gauge-verdict correct' : 'gauge-verdict incorrect'} role="status">
          {t(correct ? 'walkAround.defects.correct' : 'walkAround.defects.incorrect')}
        </p>
      )}
      {answered && active.feedback && <p className="task-note">{active.feedback}</p>}
      {answered && nextScenario && (
        <button type="button" className="scenario-next-button" onClick={() => onSelectScenario(nextScenario.id)}>
          {t('walkAround.defects.next')}
        </button>
      )}
      <p className="task-note">{t('walkAround.defects.score', { correct: scenarioScore(data, state), total })}</p>
      {first.answered > 0 && (
        <p className="task-note">{t('walkAround.defects.firstScore', { correct: first.correct, total: first.answered })}</p>
      )}
    </>
  )
}

export function WalkAroundTask({ data, content, state, engineStarted, cab = NO_CAB_STATUS, scenarios = [], activeScenarioId, handlers }) {
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
        <EngineOnTask data={data} state={state} cab={cab} onGauge={handlers.onGauge} />
      )}
      {phase === 'defect-test' && (
        <DefectTask
          data={data}
          scenarios={scenarios}
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
