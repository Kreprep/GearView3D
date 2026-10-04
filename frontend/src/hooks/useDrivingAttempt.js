import { useEffect, useRef, useState } from 'react'
import { getAudioEngine } from '../lib/audio/audioEngine'
import { DRIVING_SOUNDS } from '../data/soundBank'
import { createCabGauges, stepCabGauges } from '../lib/driving/cabGauges'
import { createClusterClock, stepClusterClock } from '../lib/driving/clusterClock'
import { cockpitSnapshot } from '../lib/driving/cockpitTelemetry'
import { createKeyActiveTracker, mergeControls, neutralControls } from '../lib/driving/controls'
import { applyCabCommand, cabPowered, createDashboardSource } from '../lib/driving/dashboardSource'
import { createDrivingAudio } from '../lib/driving/drivingAudio'
import { loadControllerConfig, subscribeToControllerConfig } from '../lib/driving/controllerStore'
import { snapshotGamepads } from '../lib/driving/gamepadBrowser'
import { createWheelSource } from '../lib/driving/wheelSource'
import { proximityReadout } from '../lib/driving/proximity'
import { createSafetyMonitor } from '../lib/driving/safetyMonitor'
import { createSimCore } from '../lib/driving/simCore'
import { createSimLoop } from '../lib/driving/simLoop'
import { capturePose, createPoseBuffer } from '../lib/driving/syncView'
import { createTelemetryStore, TELEMETRY_INTERVAL } from '../lib/driving/telemetry'
import { useDrivingInput } from './useDrivingInput'

// The wheel's name for a view command, where it differs from the keyboard's.
const VIEW_COMMAND_ALIASES = { inset: 'toggleInset' }

// Everything the driving screen shows, published into the telemetry store
// (lib/driving/telemetry.js) rather than set as React state every frame.
function publishCockpit(telemetry, core, course, { controls, switches, gauges, clock, faults, wheel }) {
  telemetry.publish(
    cockpitSnapshot(core.state, course, {
      controls,
      switches,
      gauges,
      clock,
      faults,
      wheel,
      proximity: proximityReadout(core.state, core.world),
    }),
  )
}

// One driving attempt, whatever it is composed into (a course, or the cab
// inspection, components/inspection/CabInspectionViewer.jsx): the simulation
// core, the input sources (keyboard,
// dashboard, wheel), the cockpit telemetry, the safety watch, the sound and
// the fixed-step loop. No scene and no camera: components/driving/
// DrivingStage.jsx draws the attempt and calls frame() once per rendered
// frame. The caller keys its component on the attempt, so "Reset attempt"
// builds all of this afresh.
//
// `onEvent` receives the viewer's event vocabulary (hooks/
// useDrivingController.jsx), which is unchanged. `instrumentFaults`
// ({ [instrumentId]: fault }, lib/inspection/instruments.js) script what the
// dashboard reads; they never reach the simulation. `observe`, if given, is
// called once per frame after the steps with { state, switches, horn } (horn:
// whether it sounded this frame), for a watcher that reads the attempt, like
// the inspection monitor; it must not write the state.
export function useDrivingAttempt({ course, profile, onEvent, instrumentFaults = null, observe = null }) {
  const [core] = useState(() => createSimCore(course, profile))
  const [safety] = useState(() => createSafetyMonitor(course))
  // What SafetySigns draws: the alert queue's `shown` list.
  const [signs] = useState(() => createTelemetryStore({ signs: [] }))
  const [dashboard] = useState(createDashboardSource)
  const [wheel] = useState(() => createWheelSource(loadControllerConfig()))
  const [telemetry] = useState(() => {
    const store = createTelemetryStore(null)
    publishCockpit(store, core, course, { controls: neutralControls(), switches: dashboard.switches, gauges: createCabGauges(), faults: instrumentFaults })
    return store
  })
  const { source: keyboard, pressed } = useDrivingInput()
  const [failInfo, setFailInfo] = useState(null)
  const telemetryClockRef = useRef(0)

  // The fixed-step loop. Each step first records the pose it starts from, so
  // syncView can interpolate the render between the last two steps.
  const [sim] = useState(() => {
    const prevPose = capturePose(core.state, createPoseBuffer())
    const keyTracker = createKeyActiveTracker()
    let lastControls = neutralControls()
    // The cab switches the completion code can read, as last reported.
    let lastCab = null
    const loop = createSimLoop((dt) => {
      capturePose(core.state, prevPose)
      // The wheel first: a shifter's lever beats the dashboard's.
      const leverEngaged = dashboard.switches.lever !== null || wheel.status().shifter
      lastControls = mergeControls([wheel.read(), keyboard.read(core.state, { leverEngaged, dt }), dashboard.read()])
      core.step(dt, lastControls)
    })
    return {
      prevPose,
      loop,
      // Illustrative fuel, temperature and hours (lib/driving/cabGauges.js):
      // view-side, not part of the simulation.
      gauges: createCabGauges(),
      // The bulb check and the time since key-on and start, for faults.
      clock: createClusterClock(),
      controls: () => lastControls,
      // The keysUsed adapter: the old keyboard letters, reported once per
      // press, for free-practice completion code.
      freshKeys: () => keyTracker.update(lastControls, keyboard.drainLetters()),
      // The seatbelt and parking brake when either changed since the last
      // call, else null.
      cabChange: () => {
        const { seatbelt, parkingBrake } = lastControls
        if (lastCab && lastCab.seatbelt === seatbelt && lastCab.parkingBrake === parkingBrake) return null
        lastCab = { seatbelt, parkingBrake }
        return lastCab
      },
    }
  })

  // This attempt's sound. The samples are fetched here, when a driving step
  // mounts, and nowhere earlier. Built in an effect because it starts loops
  // on the shared audio engine, which the cleanup has to stop.
  const audioRef = useRef(null)
  useEffect(() => {
    const engine = getAudioEngine()
    engine.preload(DRIVING_SOUNDS)
    const audio = createDrivingAudio(engine, { capacityKg: course.capacityKg })
    audioRef.current = audio
    return () => {
      audioRef.current = null
      audio.dispose()
    }
  }, [course.capacityKg])

  useEffect(() => {
    core.setProfile(profile)
  }, [core, profile])

  // The core owns a physics world, which has to be freed. The free waits a
  // tick so that React's development double-mount, which runs this cleanup
  // and then the effect again on the same core, cancels it.
  const disposeTimerRef = useRef(null)
  useEffect(() => {
    clearTimeout(disposeTimerRef.current)
    return () => {
      disposeTimerRef.current = setTimeout(() => core.dispose(), 0)
    }
  }, [core])

  // A binding changed in Controller Setup applies to the running attempt.
  useEffect(() => subscribeToControllerConfig((config) => wheel.setConfig(config)), [wheel])

  // Dev-only test hooks: warp truck/fork state directly instead of faking held
  // keys, so browser-automation checks can reach a course's pallets/cones
  // without fighting acceleration/drag timing, and read the state back.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__drivingDebugSet = (patch = {}) => {
      core.debugSet(patch)
      // The cab switches are the dashboard's. `direction` sets its lever;
      // 'auto' hands direction back to the keyboard.
      if (typeof patch.seatbelt === 'boolean') dashboard.set('seatbelt', patch.seatbelt)
      if (typeof patch.parkingBrake === 'boolean') dashboard.set('parkingBrake', patch.parkingBrake)
      for (const name of ['lights', 'beacon']) if (typeof patch[name] === 'boolean') dashboard.set(name, patch[name])
      if (typeof patch.turnSignal === 'string') dashboard.setSignal(patch.turnSignal)
      if (patch.direction === 'auto') dashboard.releaseLever()
      else if (typeof patch.direction === 'string') dashboard.setLever(patch.direction)
      // A warp is not motion: don't smear the render across it.
      capturePose(core.state, sim.prevPose)
    }
    return () => {
      delete window.__drivingDebugSet
      delete window.__drivingDebug
    }
  }, [core, sim, dashboard])

  const onEventRef = useRef(onEvent)
  const observeRef = useRef(observe)
  useEffect(() => {
    onEventRef.current = onEvent
    observeRef.current = observe
  }, [onEvent, observe])

  // The core's events, turned into the viewer's own event vocabulary
  // (hooks/useDrivingController.jsx), which is unchanged. They are raised
  // from inside the frame loop, so they reach the page on the next tick.
  const emit = (event) => setTimeout(() => onEventRef.current?.(event), 0)
  const handleSimEvent = (event) => {
    // The starter, the engine stopping and the interlock's refusal (which
    // the cluster also shows: cockpitSnapshot's need*).
    audioRef.current?.handleEvent(event)
    if (event.type === 'engine') {
      emit({ type: event.on ? 'engine-on' : 'engine-off' })
    } else if (event.type === 'fail') {
      const info = profile.failMessages[event.reason] || { title: 'Attempt Failed', message: 'Reset the attempt and try again.' }
      setFailInfo({ reason: event.reason, ...info })
      emit({ type: 'sim-failed', reason: event.reason, title: info.title, message: info.message })
    } else if (event.type === 'checkpoint') {
      const { checkpoint, isLast } = event
      emit({
        type: isLast ? 'course-complete' : 'checkpoint',
        id: checkpoint.id,
        label: checkpoint.label,
        message: checkpoint.completeMessage,
      })
    } else if (event.type === 'pallet') {
      emit(event.event)
    } else if (event.type === 'parking' && event.isParked) {
      emit({ type: 'parking-complete' })
    }
  }

  // A new attempt starts from an empty tally: the page must not carry the
  // last attempt's count into this one's record.
  useEffect(() => {
    const timer = setTimeout(() => onEventRef.current?.({ type: 'safety-tally', tally: safety.tally() }), 0)
    return () => clearTimeout(timer)
  }, [safety])

  // One rendered frame: commands, then as many fixed sim steps as the frame
  // covers, then everything that reads the state the steps left. `view` is
  // { firstPerson, lookYaw } for the safety rules, and `onViewCommand` takes
  // the camera and inset commands. Returns the interpolation alpha for
  // syncView.
  const frame = (rawDelta, { firstPerson, lookYaw, onViewCommand }) => {
    // Poll the wheel once per frame; the browser updates gamepad state no
    // faster than that.
    wheel.update(snapshotGamepads())
    // Keyboard and wheel commands first: E (or the wheel's engine button)
    // turns the dashboard's key, B / Space / H / L / O / [ / ] work its
    // switches, and the rest (camera, inset) go to the view. Then whatever
    // the key switch decided reaches the simulation.
    for (const command of [...keyboard.drainCommands(), ...wheel.drainCommands()]) {
      if (!applyCabCommand(dashboard, command, core.state.truck.engineOn)) onViewCommand(VIEW_COMMAND_ALIASES[command] || command)
    }
    let horn = false
    for (const command of dashboard.drainCommands()) {
      if (command === 'horn') {
        horn = true
        audioRef.current?.horn()
      } else {
        core.command(command)
      }
    }
    const { alpha } = sim.loop.advance(rawDelta)
    const { engineOn } = core.state.truck
    stepCabGauges(sim.gauges, { engineOn, throttle: sim.controls().throttle }, rawDelta)
    const clockWas = sim.clock.bulbCheck
    stepClusterClock(sim.clock, { powered: cabPowered(dashboard.switches, engineOn), engineOn }, rawDelta)

    // The safety signs (lib/driving/safetyMonitor.js) judge the state the
    // steps just left. They go first, so a sign that came up with the step
    // that completes the course is in the tally the page records with it.
    const alerts = safety.update(core.state, core.world, { firstPerson, lookYaw })
    signs.publish({ signs: alerts.shown })
    if (alerts.edges.length) {
      audioRef.current?.handleAlerts(alerts.edges)
      // The attempt's violation count so far, for the page's progress
      // record (lib/simulationProgress.js, attemptStats).
      emit({ type: 'safety-tally', tally: safety.tally() })
    }

    const events = core.drainEvents()
    events.forEach(handleSimEvent)
    observeRef.current?.({ state: core.state, switches: dashboard.switches, horn })
    // Sound follows the state the steps just left (lib/driving/drivingAudio.js).
    audioRef.current?.update(core.state, dashboard.switches)
    sim.freshKeys().forEach((key) => emit({ type: 'key-active', key }))
    // For free-practice completion code (context.seatbelt / parkingBrake).
    const cab = sim.cabChange()
    if (cab) emit({ type: 'cab-switch', seatbelt: cab.seatbelt, parkingBrake: cab.parkingBrake })

    if (import.meta.env.DEV) {
      const { lights, beacon, turnSignal } = dashboard.switches
      window.__drivingDebug = { ...core.debugSnapshot(), ...safety.debugSnapshot(), lights, beacon, turnSignal }
    }

    // The HUD refreshes at TELEMETRY_HZ, and at once when something happened
    // or a dashboard switch moved.
    telemetryClockRef.current += rawDelta
    // The bulb check ending is a change too.
    const bulbCheckEnded = clockWas > 0 && sim.clock.bulbCheck === 0
    if (dashboard.takeChanged() || events.length || bulbCheckEnded || telemetryClockRef.current >= TELEMETRY_INTERVAL) {
      telemetryClockRef.current = 0
      publishCockpit(telemetry, core, course, {
        controls: sim.controls(),
        switches: dashboard.switches,
        gauges: sim.gauges,
        clock: sim.clock,
        faults: instrumentFaults,
        wheel: wheel.status(),
      })
    }
    return alpha
  }

  return { core, dashboard, keyboard, pressed, telemetry, signs, failInfo, prevPose: sim.prevPose, frame }
}
