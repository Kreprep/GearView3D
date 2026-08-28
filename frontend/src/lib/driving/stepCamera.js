// First-person, chase-orbit or free-cam (free-cam is left entirely to
// OrbitControls in DrivingScene's JSX, so this only handles the other two).
export function stepCamera(ctx, dt) {
  const {
    firstPerson, freeCam, profile, posRef, camera,
    seatWorldRef, seatLookRef, orbitTargetRef, camAdjustedRef, orbitDeltaRef, prevOrbitTargetRef,
    backRef, desiredCamRef, lookTargetRef, vehicleOrbitRef, frame,
  } = ctx
  const { forwardX, forwardZ } = frame

  if (firstPerson) {
    const [seatX, seatY, seatZ] = profile.rig.cabin.seatOffset
    seatWorldRef.current.set(
      posRef.current.x + seatX * forwardZ + seatZ * forwardX,
      posRef.current.y + seatY,
      posRef.current.z - seatX * forwardX + seatZ * forwardZ,
    )
    seatLookRef.current.set(
      seatWorldRef.current.x + forwardX * 5,
      seatWorldRef.current.y,
      seatWorldRef.current.z + forwardZ * 5,
    )
    camera.position.copy(seatWorldRef.current)
    camera.lookAt(seatLookRef.current)
  } else if (!freeCam) {
    orbitTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
    if (camAdjustedRef.current) {
      // The user has orbited by hand: OrbitControls only re-aims at a moved
      // target, it does not reposition the camera - so carry the camera by
      // the same delta the vehicle moved this frame to keep the orbit
      // rigidly anchored to it instead of the camera staying put while the
      // vehicle drives out from under it.
      camera.position.add(orbitDeltaRef.current.subVectors(orbitTargetRef.current, prevOrbitTargetRef.current))
    } else {
      backRef.current.set(-forwardX, 0, -forwardZ)
      desiredCamRef.current.copy(posRef.current).addScaledVector(backRef.current, 2.6)
      desiredCamRef.current.y += 1.5
      camera.position.lerp(desiredCamRef.current, 1 - Math.pow(0.0001, dt))
      lookTargetRef.current.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z)
      camera.lookAt(lookTargetRef.current)
    }
    prevOrbitTargetRef.current.copy(orbitTargetRef.current)
    if (vehicleOrbitRef.current) {
      vehicleOrbitRef.current.target.copy(orbitTargetRef.current)
    }
  }
}
