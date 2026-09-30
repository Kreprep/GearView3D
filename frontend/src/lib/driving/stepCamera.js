import { cameraPose, cameraShot } from './cameraModes.js'

// Puts the camera where the camera state (cameraModes.js) says, following the
// rendered truck pose syncView() returns. A view step, not a sim step: it runs
// once per rendered frame with the render delta, after syncView.
//
// First-person rides the seat exactly, and a D-pad glance eases the look
// round (easeGlance). The chase stops ease toward their
// pose, so stepping round the truck or turning doesn't snap the view. The
// stop behind the truck can also be orbited by hand, and free is left
// entirely to OrbitControls.
export function stepCamera(ctx, pose, dt) {
  const {
    cameraState, forkHeight, profile, camera,
    lookYawRef, lookPitchRef, glanceRef, orbitTargetRef, camAdjustedRef, orbitDeltaRef, prevOrbitTargetRef,
    desiredCamRef, lookTargetRef, vehicleOrbitRef,
  } = ctx

  if (glanceRef.current) easeGlance(lookYawRef, lookPitchRef, glanceRef, dt)

  const target = cameraPose(cameraState, pose, {
    forkHeight,
    seatOffset: profile.rig.cabin.seatOffset,
    lookYaw: lookYawRef.current,
    lookPitch: lookPitchRef.current,
  })
  if (!target) return

  const shot = cameraShot(cameraState)
  if (shot === 'first-person') {
    camera.position.set(...target.position)
    lookTargetRef.current.set(...target.target)
    camera.lookAt(lookTargetRef.current)
    return
  }

  if (shot === 'behind') {
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

  ease(camera, desiredCamRef.current, lookTargetRef.current, target, dt)
}

// How long a D-pad glance takes to (nearly) arrive: quick, like turning your
// head, but eased so it reads as a turn rather than a cut.
const GLANCE_SECONDS = 0.35
const GLANCE_DONE = 1e-3

// Turn the first-person look toward the pending glance, and drop it once
// there.
function easeGlance(lookYawRef, lookPitchRef, glanceRef, dt) {
  const glance = glanceRef.current
  const amount = 1 - Math.pow(0.0001, dt / GLANCE_SECONDS)
  lookYawRef.current += (glance.yaw - lookYawRef.current) * amount
  lookPitchRef.current += (glance.pitch - lookPitchRef.current) * amount
  if (Math.abs(glance.yaw - lookYawRef.current) < GLANCE_DONE && Math.abs(glance.pitch - lookPitchRef.current) < GLANCE_DONE) {
    lookYawRef.current = glance.yaw
    lookPitchRef.current = glance.pitch
    glanceRef.current = null
  }
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
