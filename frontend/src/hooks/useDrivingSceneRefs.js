import { useEffect, useRef } from 'react'
import { Euler, Quaternion, Vector3 } from 'three'

// Every mutable ref DrivingScene's per-frame steps (stepDrive/stepCollision/
// stepForks/stepPallet/stepFail/stepGoals/stepCamera) read and write, plus the
// two prop-shadow refs (onFail/onParkingUpdate) those steps call through
// rather than closing over a prop that can go stale. One hook so the scene
// component itself doesn't carry ~30 useRef() calls.
export function useDrivingSceneRefs({ onFail, onParkingUpdate }) {
  const rigRef = useRef(null)
  const vehicleOrbitRef = useRef(null)
  const seatWorldRef = useRef(new Vector3())
  const seatLookRef = useRef(new Vector3())
  // First-person look-around offset from the vehicle's own forward direction
  // (radians), driven by dragging the scene - see DrivingScene's pointer
  // handlers and stepCamera.
  const lookYawRef = useRef(0)
  const lookPitchRef = useRef(0)
  const orbitTargetRef = useRef(new Vector3())
  const prevOrbitTargetRef = useRef(new Vector3())
  const orbitDeltaRef = useRef(new Vector3())

  const hudAccumRef = useRef(0)
  const backRef = useRef(new Vector3())
  const desiredCamRef = useRef(new Vector3())
  const lookTargetRef = useRef(new Vector3())

  const forkHeightRef = useRef(0)
  const tiltAngleRef = useRef(0)
  const steerAngleRef = useRef(0)
  const palletRefs = useRef([])
  const palletSimRef = useRef(null)
  const palletFootprintsRef = useRef([])
  const bodyRectRef = useRef({ x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 })
  const palletRectRef = useRef({ x: 0, z: 0, rotation: 0, halfX: 0, halfZ: 0 })
  const gripLocalRef = useRef(new Vector3())
  const palletEulerRef = useRef(new Euler(0, 0, 0, 'YXZ'))
  const gripQuatRef = useRef(new Quaternion())
  const carriageQuatRef = useRef(new Quaternion())
  const gripQualityRef = useRef('none')
  const carriedIndexRef = useRef(-1)
  const deliveredCountRef = useRef(0)
  const prevSpeedRef = useRef(0)
  const failedRef = useRef(false)
  const tipPivotRef = useRef(null)
  const tipStateRef = useRef({ active: false, angle: 0, vel: 0 })
  const coneRefs = useRef([])
  const coneSimRef = useRef(null)
  const coneAxisRef = useRef(new Vector3())
  const coneQuatRef = useRef(new Quaternion())

  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  }, [onFail])

  const parkedRef = useRef(false)
  const parkingStatusRef = useRef('')
  const onParkingUpdateRef = useRef(onParkingUpdate)
  useEffect(() => {
    onParkingUpdateRef.current = onParkingUpdate
  }, [onParkingUpdate])

  return {
    rigRef,
    vehicleOrbitRef,
    seatWorldRef,
    seatLookRef,
    lookYawRef,
    lookPitchRef,
    orbitTargetRef,
    prevOrbitTargetRef,
    orbitDeltaRef,
    hudAccumRef,
    backRef,
    desiredCamRef,
    lookTargetRef,
    forkHeightRef,
    tiltAngleRef,
    steerAngleRef,
    palletRefs,
    palletSimRef,
    palletFootprintsRef,
    bodyRectRef,
    palletRectRef,
    gripLocalRef,
    palletEulerRef,
    gripQuatRef,
    carriageQuatRef,
    gripQualityRef,
    carriedIndexRef,
    deliveredCountRef,
    prevSpeedRef,
    failedRef,
    tipPivotRef,
    tipStateRef,
    coneRefs,
    coneSimRef,
    coneAxisRef,
    coneQuatRef,
    onFailRef,
    parkedRef,
    parkingStatusRef,
    onParkingUpdateRef,
  }
}
