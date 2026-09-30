import { useEffect, useRef, useState } from 'react'
import { Gamepad2, X } from 'lucide-react'
import { useT } from '../../i18n'
import { useGamepadPoll } from '../../hooks/useGamepadPoll'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { loadControllerConfig, resetControllerConfig, saveControllerConfig } from '../../lib/driving/controllerStore'
import {
  bindCaptured,
  calibratePedal,
  calibrateSteering,
  clearAction,
  createRangeTracker,
  deviceLabel,
  inputForAction,
  setRotation,
  setSteeringLock,
} from '../../lib/driving/controllerSetup'
import {
  AXIS_ACTIONS,
  COMMAND_ACTIONS,
  decodeHat,
  defaultControllerConfig,
  detectInput,
  findPad,
  HELD_ACTIONS,
  PEDAL_ACTIONS,
  rotationFor,
  SHIFTER_ACTIONS,
  STEER_ACTION,
} from '../../lib/driving/gamepad'
import { CAMERA_COMMANDS } from '../../lib/driving/cameraModes'
import { gamepadsSupported } from '../../lib/driving/gamepadBrowser'
import { createWheelSource } from '../../lib/driving/wheelSource'

// Controller Setup (docs/revisions/post-defense-plan.md, section 4.3): a
// steering wheel, pedals and shifter bound and calibrated for this machine.
// Opened from the driving HUD and from the hub.
//
// - A live readout of every connected pad's axes and buttons, and of the
//   operator controls they produce (which doubles as the test drive).
// - Calibration: turn the wheel lock to lock, press each pedal, select each
//   gear.
// - A binding table with "press the control now" capture.
//
// Everything is saved to localStorage as it changes (controllerStore.js),
// and an open driving screen picks the change up at once.

const BINDING_GROUPS = [
  { titleKey: 'controller.group.driving', actions: AXIS_ACTIONS },
  { titleKey: 'controller.group.direction', actions: SHIFTER_ACTIONS },
  { titleKey: 'controller.group.hydraulics', actions: HELD_ACTIONS },
  { titleKey: 'controller.group.cab', actions: COMMAND_ACTIONS.filter((action) => !CAMERA_COMMANDS.includes(action) && action !== 'inset') },
  { titleKey: 'controller.group.view', actions: [...CAMERA_COMMANDS, 'inset'] },
]
const APPEND_ACTIONS = ['gearForward', 'gearReverse']
// The TH8A's H-pattern is seven gears and reverse; Skip passes over a gear a
// shifter doesn't have.
const GEAR_STEPS = ['1', '2', '3', '4', '5', '6', '7', 'R']

const actionLabelKey = (action) => `controller.action.${action}`
const percent = (value) => `${Math.round(value * 100)}%`
// Re-render only when something visible changed, not on every frame.
const padSignature = (pads) => pads.map((pad) => `${pad.key}|${pad.axes.map((value) => value.toFixed(2)).join(',')}|${pad.buttons.map((value) => (value > 0.5 ? 1 : 0)).join('')}`).join(';')

function InputText({ input, pads }) {
  const t = useT()
  const device = deviceLabel(input.device, pads)
  if (input.kind === 'axis') return t('controller.input.axis', { device, index: input.index })
  if (input.kind === 'hat') return t('controller.input.hat', { device, direction: t(`controller.hat.${input.direction}`) })
  return t('controller.input.button', { device, index: input.index + 1 })
}

// `hatAxes` is the set of "key#index" axes that have read as a centred hat
// (outside -1..1), so a pushed hat still shows as a direction, not a bar.
function LiveReadout({ pads, hatAxes }) {
  const t = useT()
  if (!pads.length) return <p className="text-sm text-muted">{t('controller.pressAnyButton')}</p>
  return (
    <div className="grid gap-3">
      {pads.map((pad) => (
        <div key={pad.key} className="rounded-xl border border-border p-3">
          <p className="text-sm font-bold text-ink">
            {deviceLabel(pad.key, pads)} <span className="font-normal text-muted">({pad.key})</span>
          </p>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-x-3 gap-y-1">
            {pad.axes.map((value, index) => {
              const hat = decodeHat(value)
              return (
                <div key={index} className="flex items-center gap-1.5 text-xs text-body">
                  <span className="w-11 shrink-0 font-mono">{t('controller.axisShort', { index })}</span>
                  {hatAxes.has(`${pad.key}#${index}`) ? (
                    <span className="font-mono">{hat ? t(`controller.hat.${hat}`) : t('controller.hat.centred')}</span>
                  ) : (
                    <span className="relative h-2 flex-1 rounded bg-status-track" aria-label={value.toFixed(2)}>
                      <span className="absolute top-0 h-2 w-1 rounded bg-accent" style={{ left: `calc(${((value + 1) / 2) * 100}% - 2px)` }} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {pad.buttons.map((value, index) => (
              <span
                key={index}
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1 font-mono text-[11px] ${value > 0.5 ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function OutputReadout({ pads, config }) {
  const t = useT()
  const [wheel] = useState(() => createWheelSource(config))
  wheel.setConfig(config)
  wheel.update(pads)
  const controls = wheel.read()
  const wheelDeg = controls.steeringWheelAngle === null ? null : Math.round((controls.steeringWheelAngle * 180) / Math.PI)
  const rows = [
    [t('controller.action.steer'), wheelDeg === null ? '-' : t('controller.output.steer', { degrees: -wheelDeg, lock: percent(Math.abs(controls.steer)) })],
    [t('controller.action.throttle'), percent(controls.throttle)],
    [t('controller.action.brake'), percent(controls.brake)],
    [t('controller.action.inching'), percent(controls.inching)],
    [t('controller.output.direction'), controls.explicitDirection ? controls.direction : t('controller.output.noShifter')],
    [t('controller.output.lift'), controls.lift],
    [t('controller.output.tilt'), controls.tilt],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="font-mono text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ControllerSetup({ onClose }) {
  const t = useT()
  const dialogRef = useRef(null)
  // The pads as last shown, and which of their axes are hats.
  const [{ pads, hatAxes }, setView] = useState({ pads: [], hatAxes: new Set() })
  // Mirrored in refs: the poll runs every frame and must see a change at
  // once, not after the next render, or one press could bind twice.
  const [config, setConfigState] = useState(loadControllerConfig)
  const configRef = useRef(config)
  // Waiting for "press the control now": { action, append, baseline }.
  const [capture, setCaptureState] = useState(null)
  const captureRef = useRef(null)
  // A calibration in progress: { kind: 'steering' | 'pedal' | 'gears', ... }.
  const [wizard, setWizardState] = useState(null)
  const wizardRef = useRef(null)
  const signatureRef = useRef('')
  const trackerRef = useRef(null)
  const hatAxesRef = useRef(new Set())

  const setCapture = (next) => {
    captureRef.current = next
    setCaptureState(next)
  }
  const setWizard = (next) => {
    wizardRef.current = next
    setWizardState(next)
  }
  const update = (next) => {
    configRef.current = next
    setConfigState(next)
    saveControllerConfig(next)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const steerInput = config.bindings[STEER_ACTION]?.[0]
  const wizardAxis = (current = wizardRef.current, bindings = configRef.current.bindings) => {
    if (current?.kind === 'steering') return bindings[STEER_ACTION]?.[0]
    if (current?.kind === 'pedal') return bindings[current.action]?.[0]
    return null
  }
  const axisValue = (input, fromPads) => (input ? findPad(fromPads, input.device)?.axes[input.index] : undefined)

  const advanceGears = (step, baseline) => {
    setWizard(step >= GEAR_STEPS.length ? null : { kind: 'gears', step, baseline })
  }

  useGamepadPoll((next) => {
    // Calibration ranges and captures read every frame; the view only
    // re-renders when something it shows changed.
    for (const pad of next) {
      pad.axes.forEach((value, index) => {
        if (Math.abs(value) > 1.1) hatAxesRef.current.add(`${pad.key}#${index}`)
      })
    }
    const axis = wizardAxis()
    if (axis && trackerRef.current) trackerRef.current.add(axisValue(axis, next))

    const pending = captureRef.current
    if (pending) {
      const hit = detectInput(pending.baseline, next)
      if (hit && inputForAction(pending.action, hit)) {
        update(bindCaptured(configRef.current, pending.action, hit, { append: pending.append }))
        setCapture(null)
      }
    }
    // Each gear is the next button pressed that wasn't held when the step
    // began, so moving from one gear to the next records the new one.
    const gears = wizardRef.current
    if (gears?.kind === 'gears') {
      const hit = detectInput(gears.baseline, next)
      if (hit?.kind === 'button') {
        const gear = GEAR_STEPS[gears.step]
        update(bindCaptured(configRef.current, gear === 'R' ? 'gearReverse' : 'gearForward', hit, { append: true }))
        advanceGears(gears.step + 1, next)
      }
    }

    const signature = padSignature(next)
    if (signature !== signatureRef.current) {
      signatureRef.current = signature
      setView({ pads: next, hatAxes: new Set(hatAxesRef.current) })
    }
  })

  const startCapture = (action) => {
    setWizard(null)
    setCapture({ action, append: APPEND_ACTIONS.includes(action), baseline: pads })
  }

  const startAxisWizard = (kind, action) => {
    setCapture(null)
    trackerRef.current = createRangeTracker()
    setWizard({ kind, action })
  }

  const finishAxisWizard = () => {
    const input = wizardAxis()
    const { min, max } = trackerRef.current?.range || {}
    const rest = axisValue(input, pads)
    if (input && typeof rest === 'number') {
      update(wizard.kind === 'steering' ? calibrateSteering(config, { min, max, center: rest }) : calibratePedal(config, wizard.action, { min, max, rest }))
    }
    trackerRef.current = null
    // Pedals run one after another.
    const nextPedal = wizard.kind === 'pedal' ? PEDAL_ACTIONS[PEDAL_ACTIONS.indexOf(wizard.action) + 1] : null
    if (nextPedal && config.bindings[nextPedal]?.length) startAxisWizard('pedal', nextPedal)
    else setWizard(null)
  }

  const startGears = () => {
    setCapture(null)
    update(clearAction(clearAction(config, 'gearForward'), 'gearReverse'))
    advanceGears(0, pads)
  }

  const resetAll = () => {
    resetControllerConfig()
    const defaults = defaultControllerConfig()
    configRef.current = defaults
    setConfigState(defaults)
    setCapture(null)
    setWizard(null)
  }

  const steeringDevice = steerInput?.device

  const wizardPrompt = () => {
    if (!wizard) return null
    if (wizard.kind === 'steering') return t('controller.calibrate.steeringPrompt')
    if (wizard.kind === 'pedal') return t('controller.calibrate.pedalPrompt', { pedal: t(actionLabelKey(wizard.action)) })
    const gear = GEAR_STEPS[wizard.step]
    return gear === 'R' ? t('controller.calibrate.gearReverse') : t('controller.calibrate.gearForward', { gear })
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[90vh] w-[min(1000px,94vw)] overflow-y-auto rounded-2xl border border-border bg-panel p-0 text-body shadow-2xl backdrop:bg-slate-950/60"
      aria-labelledby="controller-setup-title"
      onClose={onClose}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-panel px-5 py-3">
        <h2 id="controller-setup-title" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Gamepad2 size={20} aria-hidden="true" /> {t('controller.title')}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => dialogRef.current?.close()} aria-label={t('controller.close')}>
          <X size={18} aria-hidden="true" />
        </Button>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="grid content-start gap-4">
          {!gamepadsSupported() && <p className="text-sm text-red-700">{t('controller.unsupported')}</p>}
          <p className="text-sm text-muted">{t('controller.intro')}</p>

          <div>
            <h3 className="mb-2 text-sm font-bold text-ink">{t('controller.live')}</h3>
            <LiveReadout pads={pads} hatAxes={hatAxes} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-ink">{t('controller.output')}</h3>
            <OutputReadout pads={pads} config={config} />
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-bold text-ink">{t('controller.calibrate')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-bold text-body">
                {t('controller.rotation')}
                <Input
                  type="number"
                  min={90}
                  max={3600}
                  step={90}
                  disabled={!steeringDevice}
                  value={steeringDevice ? rotationFor(config, steeringDevice) : ''}
                  onChange={(event) => update(setRotation(config, steeringDevice, Number(event.target.value)))}
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-body">
                {t('controller.lock')}
                <Input
                  type="number"
                  min={45}
                  max={1800}
                  step={45}
                  value={config.steeringLockDeg}
                  onChange={(event) => update(setSteeringLock(config, Number(event.target.value)))}
                />
              </label>
            </div>
            <p className="text-xs text-muted">{t('controller.rotationHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={!steerInput} onClick={() => startAxisWizard('steering')}>
                {t('controller.calibrate.steering')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!config.bindings[PEDAL_ACTIONS[0]]?.length}
                onClick={() => startAxisWizard('pedal', PEDAL_ACTIONS[0])}
              >
                {t('controller.calibrate.pedals')}
              </Button>
              <Button variant="secondary" size="sm" onClick={startGears}>
                {t('controller.calibrate.gears')}
              </Button>
            </div>
            {wizard && (
              <div className="grid gap-2 rounded-xl border border-accent bg-accent-soft p-3" role="status">
                <p className="text-sm font-semibold text-ink">{wizardPrompt()}</p>
                <div className="flex gap-2">
                  {wizard.kind === 'gears' ? (
                    <Button size="sm" variant="secondary" onClick={() => advanceGears(wizard.step + 1, pads)}>
                      {t('controller.calibrate.skip')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={finishAxisWizard}>
                      {t('controller.calibrate.done')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setWizard(null)}>
                    {t('controller.cancel')}
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted">{t('controller.noForceFeedback')}</p>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">{t('controller.bindings')}</h3>
            <Button variant="secondary" size="sm" onClick={resetAll}>
              {t('controller.resetAll')}
            </Button>
          </div>
          {BINDING_GROUPS.map(({ titleKey, actions }) => (
            <div key={titleKey}>
              <h4 className="mb-1 text-xs font-bold text-muted">{t(titleKey)}</h4>
              <ul className="grid gap-1">
                {actions.map((action) => {
                  const inputs = config.bindings[action] || []
                  const waiting = capture?.action === action
                  return (
                    <li key={action} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
                      <span className="font-semibold text-ink">{t(actionLabelKey(action))}</span>
                      <span className={`min-w-0 truncate text-xs ${waiting ? 'font-bold text-accent' : 'text-body'}`}>
                        {waiting
                          ? t(AXIS_ACTIONS.includes(action) ? 'controller.captureAxis' : 'controller.captureButton')
                          : inputs.length
                            ? inputs.map((input, index) => (
                                <span key={index}>
                                  {index > 0 && ', '}
                                  <InputText input={input} pads={pads} />
                                </span>
                              ))
                            : t('controller.unbound')}
                      </span>
                      <span className="flex gap-1">
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => (waiting ? setCapture(null) : startCapture(action))}>
                          {waiting ? t('controller.cancel') : t('controller.set')}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!inputs.length} onClick={() => update(clearAction(config, action))}>
                          {t('controller.clear')}
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </dialog>
  )
}
