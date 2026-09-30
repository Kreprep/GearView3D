// One compact, comparable snapshot of the driving simulation, used by the
// characterization golden file and the test that replays it. Both the
// pre-refactor recorder and the headless core hand this a `view` of the same
// shape; numbers are rounded to 1e-7 so the JSON stays readable and the
// comparison is about behaviour, not the last bit of floating point. What the
// physics engine produced (a pallet's or a cone's pose) is rounded to 1e-5,
// 0.04 mm: far finer than anything the simulation decides on.

const round = (value) => (typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value)
const roundBody = (value) => Math.round(value * 1e5) / 1e5

export function traceSnapshot(frame, view) {
  return {
    f: frame,
    x: round(view.x),
    z: round(view.z),
    heading: round(view.heading),
    speed: round(view.speed),
    forkHeight: round(view.forkHeight),
    tilt: round(view.tilt),
    steer: round(view.steer),
    grip: view.grip,
    checkpointIndex: view.checkpointIndex,
    failed: view.failed,
    tipAngle: round(view.tipAngle),
    tipAxis: view.tipAxis,
    stability: [roundBody(view.longitudinalMargin), roundBody(view.lateralMargin)],
    carriedIndex: view.carriedIndex,
    deliveredCount: view.deliveredCount,
    parkingStatus: view.parkingStatus,
    parked: view.parked,
    engineOn: view.engineOn,
    pallets: view.pallets.map((pallet) => [
      pallet.state,
      roundBody(pallet.position.x),
      roundBody(pallet.position.y),
      roundBody(pallet.position.z),
      roundBody(pallet.rotation.x),
      roundBody(pallet.rotation.y),
      roundBody(pallet.rotation.z),
      pallet.landed,
      pallet.onForks,
    ]),
    // The cones that were struck, and where they ended up.
    cones: view.cones.flatMap((cone, index) =>
      cone.hit ? [[index, roundBody(cone.position.x), roundBody(cone.position.y), roundBody(cone.position.z)]] : [],
    ),
  }
}
