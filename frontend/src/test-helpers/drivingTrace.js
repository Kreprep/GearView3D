// One compact, comparable snapshot of the driving simulation, used by the
// characterization golden file and the test that replays it. Both the
// pre-refactor recorder and the headless core hand this a `view` of the same
// shape; numbers are rounded to 1e-7 so the JSON stays readable and the
// comparison is about behaviour, not the last bit of floating point.

const round = (value) => (typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value)

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
    carriedIndex: view.carriedIndex,
    deliveredCount: view.deliveredCount,
    parkingStatus: view.parkingStatus,
    parked: view.parked,
    engineOn: view.engineOn,
    pallets: view.pallets.map((pallet) => [
      pallet.state,
      round(pallet.position.x),
      round(pallet.position.y),
      round(pallet.position.z),
      round(pallet.rotation.x),
      round(pallet.rotation.y),
      round(pallet.rotation.z),
      round(pallet.risk),
      round(pallet.insertDepth),
      pallet.landed,
    ]),
    cones: view.cones.flatMap((cone, index) => (cone.hit ? [[index, round(cone.angle)]] : [])),
  }
}
