import { deviceDetector, DETECTORS, inspectionSnapshot } from './detectors.js'

// One attempt's watch over the engine-on inspection's device tests: each
// device's detector (detectors.js) fed the state each time the simulation
// has stepped. It reads the sim state and never writes it, like the safety
// monitor (lib/driving/safetyMonitor.js). No browser APIs: the cab viewer
// runs it once per frame, the tests once per step.
//
// `devices` are the step's device rows ({ id, detect }); a device without a
// known `detect` gets its stock detector or the marker click
// (deviceDetector()).
const NO_EDGES = Object.freeze([])

export function createInspectionMonitor(devices) {
  const watched = devices.map((device) => ({ device, detect: DETECTORS[deviceDetector(device)] }))
  let memos = watched.map(() => ({}))
  let tested = []
  let lastTime = null
  // Edges between steps: a horn press or a marker click in a frame in which
  // the simulation did not step still counts on the next one.
  let horn = false
  let marked = []

  return {
    // A press of the horn, from the dashboard's commands.
    horn() {
      horn = true
    },

    // A click on a device's marker on the truck.
    mark(deviceId) {
      if (!marked.includes(deviceId)) marked = [...marked, deviceId]
    },

    // `switches` are the dashboard source's. Returns { tested, edges }: the
    // device ids tested so far, the same array until one is added, and the
    // ones added by this call.
    update(state, { switches }) {
      if (state.time === lastTime) return { tested, edges: NO_EDGES }
      lastTime = state.time
      const snapshot = inspectionSnapshot(state, { switches, horn, marked })
      horn = false
      marked = []

      const edges = []
      memos = memos.map((memo, index) => {
        if (memo.done) return memo
        const { device, detect } = watched[index]
        const next = detect(memo, snapshot, device)
        if (next.done) edges.push(device.id)
        return next
      })
      if (edges.length) tested = [...tested, ...edges]
      return { tested, edges: edges.length ? edges : NO_EDGES }
    },

    tested: () => tested,

    // For a debug hook (sim-verify).
    debugSnapshot: () => ({ tested }),
  }
}
