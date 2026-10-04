import { useRef, useState } from 'react'
import { CAMERA_COMMANDS, cameraReducer, cameraShot, initialCameraState } from '../lib/driving/cameraModes'
import { useDrivingSceneRefs } from './useDrivingSceneRefs'

// How one driving attempt is looked at: the camera (lib/driving/
// cameraModes.js), the proximity inset and the scene refs syncView and
// stepCamera write. components/driving/DrivingStage.jsx draws through it,
// and the composition around the stage (the HUD's view buttons) changes it.
// Nothing here reaches the simulation.
export function useDrivingView() {
  // First-person on every entry (docs/revisions/post-defense-plan.md, 4.1).
  const [cameraState, setCameraState] = useState(initialCameraState)
  const [insetOn, setInsetOn] = useState(true)
  // Set while the learner has hand-orbited the chase camera.
  const camAdjustedRef = useRef(false)
  const insetFrameRef = useRef(null)
  const refs = useDrivingSceneRefs()
  const shot = cameraShot(cameraState)

  // Any camera move drops a hand-orbited chase back onto its computed pose.
  const moveCamera = (command) => {
    camAdjustedRef.current = false
    setCameraState((state) => cameraReducer(state, command))
  }
  const toggleInset = () => setInsetOn((on) => !on)

  return {
    cameraState,
    shot,
    moveCamera,
    resetCamera: () => {
      camAdjustedRef.current = false
    },
    insetOn,
    toggleInset,
    // Overhead already is the bird's-eye picture.
    insetEnabled: insetOn && shot !== 'overhead',
    // Camera and inset keys, raised from the frame loop on a key or D-pad
    // press (never per frame).
    handleViewCommand: (command) => {
      if (command === 'toggleInset') toggleInset()
      else if (CAMERA_COMMANDS.includes(command)) moveCamera(command)
    },
    camAdjustedRef,
    insetFrameRef,
    refs,
  }
}
