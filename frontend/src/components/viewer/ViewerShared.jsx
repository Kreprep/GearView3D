import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import { BadgeInfo } from 'lucide-react'
import './ViewerShared.css'

// The pieces both 3D viewers need identically: framing the camera on a
// selected hotspot, the loading panel, the load-failure boundary, and loading
// the GLB itself.
//
// The viewers themselves stay separate - PartsViewport is an explore surface
// and HotspotViewer adds admin placement, device effects and defect overlays,
// so their scenes, materials and interaction genuinely differ. Only what was
// the *same* in both lives here.

const FOCUS_FRAMES = 40
const FOCUS_LERP = 0.15
const FOCUS_DISTANCE = 0.5

/**
 * Flies the camera to the selected hotspot, and back to where it was when the
 * selection is cleared.
 *
 * `cameraPreset` is optional. When one is given, a change to it means the
 * framing changed underneath us (engine-off wide view <-> engine-on cockpit
 * view), so any captured pre-focus pose is stale and gets dropped - otherwise
 * clearing the selection flies back to a pose from the wrong preset and the
 * camera fights the preset snap.
 */
export function CameraFocus({ targetId, hotspotRefs, controlsRef, resetToken, cameraPreset }) {
  const { camera } = useThree()
  const desiredCamPos = useRef(new Vector3())
  const desiredTarget = useRef(new Vector3())
  const framesRemaining = useRef(0)
  const activeId = useRef(null)
  const preFocusCamPos = useRef(new Vector3())
  const preFocusTarget = useRef(new Vector3())
  const hasPreFocus = useRef(false)

  useEffect(() => {
    activeId.current = null
    hasPreFocus.current = false
  }, [resetToken, cameraPreset])

  useFrame(() => {
    const controls = controlsRef.current

    // Clearing the selection must reset this, otherwise re-picking the same
    // hotspot later is treated as "already focused" and the camera won't move.
    if (!targetId) {
      if (activeId.current && hasPreFocus.current && controls) {
        desiredTarget.current.copy(preFocusTarget.current)
        desiredCamPos.current.copy(preFocusCamPos.current)
        framesRemaining.current = FOCUS_FRAMES
        hasPreFocus.current = false
      }
      activeId.current = null
    }

    if (controls && targetId && targetId !== activeId.current) {
      const object = hotspotRefs.current.get(targetId)
      if (object) {
        if (!hasPreFocus.current) {
          preFocusCamPos.current.copy(camera.position)
          preFocusTarget.current.copy(controls.target)
          hasPreFocus.current = true
        }
        activeId.current = targetId
        object.getWorldPosition(desiredTarget.current)
        const direction = camera.position.clone().sub(controls.target).normalize()
        desiredCamPos.current.copy(desiredTarget.current).add(direction.multiplyScalar(FOCUS_DISTANCE))
        framesRemaining.current = FOCUS_FRAMES
      }
    }

    if (framesRemaining.current > 0 && controls) {
      controls.target.lerp(desiredTarget.current, FOCUS_LERP)
      camera.position.lerp(desiredCamPos.current, FOCUS_LERP)
      controls.update()
      framesRemaining.current -= 1
    }
  })

  return null
}

export function ViewerLoadingPanel({ label = 'Loading 3D model' }) {
  return (
    <Html center>
      <div className="viewer-loading-panel">
        <div className="viewer-loading-spinner" />
        <p>{label}</p>
        <small>Preparing GearView3D viewport...</small>
      </div>
    </Html>
  )
}

// Wording stays equipment-neutral and prints the URL that actually failed -
// every equipment loads its own model through these viewers.
export class ViewerErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="viewer-error">
          <BadgeInfo />
          <h3>3D model could not be loaded</h3>
          <p>
            Confirm the GLB is available at <code>{this.props.modelUrl || '(no model URL configured)'}</code>.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
