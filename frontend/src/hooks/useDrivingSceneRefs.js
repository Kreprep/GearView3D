import { useRef } from 'react'
import { Vector3 } from 'three'

// The view-side refs DrivingScene needs: the scene objects syncView() writes
// to, and the camera's scratch vectors and look-around state (stepCamera).
// Simulation state is not here - it lives in the headless core's SimState
// (lib/driving/simCore.js).
export function useDrivingSceneRefs() {
  return {
    // Scene objects.
    rigRef: useRef(null),
    truckGroupRef: useRef(null),
    palletObjectsRef: useRef([]),
    coneObjectsRef: useRef([]),
    vehicleOrbitRef: useRef(null),
    // Camera (lib/driving/stepCamera.js).
    // First-person look-around offset from the vehicle's own forward
    // direction (radians), driven by dragging the scene.
    lookYawRef: useRef(0),
    lookPitchRef: useRef(0),
    // A D-pad glance the look is easing toward ({ yaw, pitch }), or null.
    // Dragging cancels it.
    glanceRef: useRef(null),
    orbitTargetRef: useRef(new Vector3()),
    prevOrbitTargetRef: useRef(new Vector3()),
    orbitDeltaRef: useRef(new Vector3()),
    desiredCamRef: useRef(new Vector3()),
    lookTargetRef: useRef(new Vector3()),
  }
}
