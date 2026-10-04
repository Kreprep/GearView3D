import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { VolumeX, X } from 'lucide-react'
import { useT } from '../../i18n'
import { getAudioEngine } from '../../lib/audio/audioEngine'
import { cabLampMounts } from '../../lib/driving/cabLamps'
import { createInspectionMonitor } from '../../lib/inspection/inspectionMonitor'
import { gaugeInstrumentFaults } from '../../lib/inspection/instruments'
import { engineOnGauges, GAUGE_CHOICES, instrumentTargets, PHASE_TITLE_KEYS, visibleHotspotIds } from '../../lib/walkAroundStep'
import { INSPECTION_PAD } from '../../data/inspectionPad'
import { useDrivingAttempt } from '../../hooks/useDrivingAttempt'
import { useDrivingView } from '../../hooks/useDrivingView'
import { useAudioSuspended } from '../../hooks/useAudio'
import { useTelemetry } from '../../hooks/useTelemetry'
import { DrivingStage } from '../driving/DrivingStage'
import { DrivingHudActions } from '../driving/DrivingHudActions'
import { drivingHint } from '../../lib/driving/hudHint'
import { OperatorDashboard } from '../driving/OperatorDashboard'
import { ControllerSetup } from '../driving/ControllerSetup'
import { PhysicsGate } from '../driving/PhysicsGate'
import { SafetySigns } from '../driving/SafetySigns'
import { HotspotMarkers } from '../viewer/HotspotMarkers'
import '../DrivingSimulationViewer.css'
import './CabInspectionViewer.css'

// Keys the judge popover handles itself, kept from the driving keyboard,
// which listens on window (Space would also set the parking brake).
const POPOVER_KEYS = new Set([' ', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

// The judge popover: the instrument's name (the gauge row's, admin-authored),
// the question and Normal / Abnormal, over the dashboard above the
// instrument that was clicked. Feedback goes to the task panel.
function JudgePopover({ gauge, answer, anchor, onJudge, onClose }) {
  const t = useT()
  const firstRef = useRef(null)
  useEffect(() => {
    firstRef.current?.focus()
  }, [gauge.id])

  return (
    <div
      className="cab-judge"
      role="dialog"
      aria-label={gauge.label}
      style={anchor ? { left: anchor.left, bottom: anchor.bottom } : undefined}
      onKeyDown={(event) => {
        if (!POPOVER_KEYS.has(event.key)) return
        event.stopPropagation()
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="cab-judge-head">
        <strong>{gauge.label}</strong>
        <button type="button" className="cab-judge-close" aria-label={t('walkAround.cab.judge.close')} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p>{t('walkAround.cab.judge.question')}</p>
      <div className="cab-judge-choices">
        {GAUGE_CHOICES.map(({ value, labelKey }, index) => (
          <button
            key={value}
            ref={index === 0 ? firstRef : undefined}
            type="button"
            className={answer === value ? 'is-selected' : ''}
            aria-pressed={answer === value}
            onClick={() => onJudge(gauge, value)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

// The cab composition (docs/modules/module-improvements-plan.md, 3.3): one
// attempt (hooks/useDrivingAttempt.js) parked on the inspection pad
// (data/inspectionPad.js), the step's hotspot markers and the switches'
// lamps on the truck at the live hotspot rows' places, the dashboard in
// inspect mode with the judge popover, and the inspection monitor
// (lib/inspection/inspectionMonitor.js) watching every frame for the device
// tests. Nothing here writes the simulation: the faults script only what
// the dashboard reads, and the monitor only reads.
//
// Events to the page (`onEvent`): the attempt's own (`engine-on`, ...) and
// `devices-tested` { ids } when tests tick. `onCabStatus` gets the start-up
// items' state when one changes; `onJudge(gauge, value)` an answer;
// `onHotspotSelect(hotspot)` a marker click, for its detail card.
//
// The defect test's cab scenarios use the same cab: `defects` is the
// scenario's cab effects (cabEffects() in data/defectLibrary.js: instrument,
// control and switch faults and sounds), and a defect-test row has no gauges
// to judge or devices to test, so only the faults are left.
function CabInspectionInner({ profile, data, hotspots, phaseState, defects, isAdmin, selectedHotspotId, onEvent, onCabStatus, onJudge, onHotspotSelect, onRequestReset, className }) {
  const t = useT()
  const [monitor] = useState(() => createInspectionMonitor(data.devices || []))
  const instrumentFaults = useMemo(
    () => ({ ...gaugeInstrumentFaults(data.gauges), ...defects?.instrumentFaults }),
    [data.gauges, defects],
  )
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  // Runs inside the frame loop: the page hears of a test on the next tick.
  const observe = useCallback(
    ({ state, switches, horn }) => {
      if (horn) monitor.horn()
      const { edges } = monitor.update(state, { switches })
      if (edges.length) setTimeout(() => onEventRef.current?.({ type: 'devices-tested', ids: edges }), 0)
    },
    [monitor],
  )
  const attempt = useDrivingAttempt({
    course: INSPECTION_PAD,
    profile,
    onEvent,
    instrumentFaults,
    observe,
    controlFaults: defects?.controlFaults,
    switchFaults: defects?.switchFaults,
    defectSounds: defects?.sounds,
  })
  const view = useDrivingView()
  const { telemetry, dashboard, signs, pressed } = attempt
  const [showColliders, setShowColliders] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const soundSuspended = useAudioSuspended()

  const hud = useTelemetry(telemetry, (snapshot) => snapshot)
  const { engineOn, keyPosition, seatbelt, parkingBrake, direction } = hud
  // The interlock's neutral (lib/driving/interlock.js): with the keyboard's
  // automatic lever the cab reads N at rest.
  const neutral = direction === 'N'

  // Latched for this attempt (set while rendering, the snapshot being
  // React's to read): the key has been ON (the bulb check was seen), and the
  // engine has run. Instruments become judgeable from these.
  const [keyOnSeen, setKeyOnSeen] = useState(false)
  const [started, setStarted] = useState(false)
  if (!keyOnSeen && (keyPosition !== 'off' || engineOn)) setKeyOnSeen(true)
  if (!started && engineOn) setStarted(true)

  useEffect(() => {
    onCabStatus?.({ seatbelt, parkingBrake, neutral, keyOn: keyOnSeen, engineOn, engineRan: started })
  }, [onCabStatus, seatbelt, parkingBrake, neutral, keyOnSeen, engineOn, started])

  // The instruments the step asks about, ringed on the dashboard once they
  // can be judged.
  const [selected, setSelected] = useState(null)
  const targets = instrumentTargets(data, phaseState, { keyOn: keyOnSeen, started })
  const gaugeFor = useMemo(
    () => Object.fromEntries(engineOnGauges(data).dashboard.map(({ gauge, instrument }) => [instrument, gauge])),
    [data],
  )
  const selectedGauge = selected && targets[selected] ? gaugeFor[selected] : null
  const inspect = { targets, selected: selectedGauge ? selected : null, onSelect: (instrument) => setSelected((was) => (was === instrument ? null : instrument)) }

  // The popover sits over the clicked instrument's button, measured once it
  // is drawn, in the HUD's bottom block.
  const bottomRef = useRef(null)
  const [anchor, setAnchor] = useState(null)
  useLayoutEffect(() => {
    if (!selectedGauge || !bottomRef.current) {
      setAnchor(null)
      return
    }
    const target = bottomRef.current.querySelector('.operator-inspect.is-selected')
    if (!target) return
    const box = bottomRef.current.getBoundingClientRect()
    const button = target.getBoundingClientRect()
    setAnchor({ left: button.left + button.width / 2 - box.left, bottom: box.bottom - button.top + 8 })
  }, [selectedGauge])

  const markers = useMemo(() => {
    const ids = new Set(visibleHotspotIds(data, hotspots))
    return hotspots.filter((hotspot) => ids.has(hotspot.id) && hotspot.position)
  }, [data, hotspots])
  const cabLamps = useMemo(() => cabLampMounts(hotspots), [hotspots])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    // The markers' labels by hotspot id, so a check can click one.
    const labels = Object.fromEntries(markers.map((hotspot) => [hotspot.id, hotspot.label]))
    window.__inspectionDebug = () => ({ ...monitor.debugSnapshot(), keyOnSeen, started, targets, markers: labels })
    return () => {
      delete window.__inspectionDebug
    }
  })

  return (
    <section className={`driving-simulation cab-inspection ${className}`}>
      <div className="driving-hud-top">
        <div className="driving-hud-status">
          <span className="driving-checkpoint-badge">{t(PHASE_TITLE_KEYS[data.phase] || 'walkAround.phase.engineOn')}</span>
        </div>
        <DrivingHudActions
          view={view}
          isAdmin={isAdmin}
          onReset={onRequestReset}
          onWheelSetup={() => setSetupOpen(true)}
          showColliders={showColliders}
          onToggleColliders={() => setShowColliders((on) => !on)}
          showInsetToggle={false}
        />
      </div>

      {/* An empty pad has nothing for the proximity inset to show. */}
      <DrivingStage
        attempt={attempt}
        view={{ ...view, insetEnabled: false }}
        profile={profile}
        course={INSPECTION_PAD}
        showColliders={showColliders}
        cabLamps={cabLamps}
        onTruck={
          <HotspotMarkers
            hotspots={markers}
            selectedHotspotId={selectedHotspotId}
            scenario="engine-on"
            onSelect={(hotspot) => {
              monitor.mark(hotspot.id)
              onHotspotSelect?.(hotspot)
            }}
          />
        }
      />

      {setupOpen && <ControllerSetup onClose={() => setSetupOpen(false)} />}

      <div className="driving-hud-bottom" ref={bottomRef}>
        <div className="driving-hud-upper">
          <SafetySigns store={signs} />
        </div>
        {soundSuspended && (
          <button type="button" className="driving-reset-button driving-sound-prompt" onClick={() => getAudioEngine().resume()}>
            <VolumeX size={14} aria-hidden="true" /> {t('driving.hud.enableSound')}
          </button>
        )}
        <p className="driving-hud-help">{drivingHint(t, hud, view.shot)}</p>
        <OperatorDashboard telemetry={telemetry} dashboard={dashboard} keyLegend={profile.keyLegend} pressed={pressed} inspect={inspect} />
        {selectedGauge && (
          <JudgePopover
            gauge={selectedGauge}
            answer={phaseState.gauges?.[selectedGauge.id]}
            anchor={anchor}
            onJudge={(gauge, value) => {
              onJudge(gauge, value)
              setSelected(null)
            }}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </section>
  )
}

// The engine-on step's scene. `data` is the step row's walk-around payload,
// `hotspots` the live inWalkAround rows, `phaseState` the step's saved state
// (lib/walkAroundStep.js). `profile` is the resolved vehicle profile.
export default function CabInspectionViewer({ className = '', ...props }) {
  const [resetSeed, setResetSeed] = useState(0)
  return (
    <PhysicsGate className={className}>
      <CabInspectionInner key={resetSeed} {...props} className={className} onRequestReset={() => setResetSeed((value) => value + 1)} />
    </PhysicsGate>
  )
}
