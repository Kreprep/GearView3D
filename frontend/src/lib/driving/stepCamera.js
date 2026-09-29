import { cameraPose, EASED_MODES } from './cameraModes.js'

// Puts the camera where the current mode (cameraModes.js) says, following the
// rendered truck pose syncView() returns. A view step, not a sim step: it runs
// once per rendered frame with the render delta, after syncView.
//
// First-person rides the seat exactly. The other computed modes ease toward
// their pose, so switching modes or turning doesn't snap the view. Chase can
// also be orbited by hand, and free is left entirely to OrbitControls.
export function stepCamera(ctx, pose, dt) {
  const {
    cameraMode, forkHeight, profile, camera,
    lookYawRef, lookPitchRef, orbitTargetRef, camAdjustedRef, orbitDeltaRef, prevOrbitTargetRef,
    desiredCamRef, lookTargetRef, vehicleOrbitRef,
  } = ctx

  const target = cameraPose(cameraMode, pose, {
    forkHeight,
    seatOffset: profile.rig.cabin.seatOffset,
    lookYaw: lookYawRef.current,
    lookPitch: lookPitchRef.current,
  })
  if (!target) return

  if (cameraMode === 'chase') {
    orbitTargetRef.current.set(...target.target)
    if (camAdjustedRef.current) {
      // The user has orbited by hand: OrbitControls only re-aims at a moved
      // target, it does not reposition the camera - so carry the camera by
      // the same delta the vehicle moved this frame to keep the orbit
      // rigidly anchored to it instead of the camera staying put while the
      // vehicle drives out from under it.
      camera.position.add(orbitDeltaRef.current.subVectors(orbitTargetRef.current, prevOrbitTargetRef.current))
    } else {
      ease(camera, desiredCamRef.current, lookTargetRef.current, target, dt)
    }
    prevOrbitTargetRef.current.copy(orbitTargetRef.current)
    if (vehicleOrbitRef.current) vehicleOrbitRef.current.target.copy(orbitTargetRef.current)
    return
  }

  if (EASED_MODES.has(cameraMode)) {
    ease(camera, desiredCamRef.current, lookTargetRef.current, target, dt)
    return
  }

  camera.position.set(...target.position)
  lookTargetRef.current.set(...target.target)
  camera.lookAt(lookTargetRef.current)
}

// Move the camera and its aim point most of the way to the target pose. The
// rate is frame-rate independent: after one second 99.99% of the gap is
// closed, whatever the display's refresh rate.
function ease(camera, desired, lookTarget, target, dt) {
  const amount = 1 - Math.pow(0.0001, dt)
  camera.position.lerp(desired.set(...target.position), amount)
  lookTarget.lerp(desired.set(...target.target), amount)
  camera.lookAt(lookTarget)
}
