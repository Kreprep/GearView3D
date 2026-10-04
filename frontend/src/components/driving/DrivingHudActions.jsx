import { Box, Compass, Gamepad2, Locate, Radar, RotateCcw } from 'lucide-react'
import { useT } from '../../i18n'
import { CAMERA_VIEWS, DEFAULT_CAMERA_VIEW, FREE_CAMERA_VIEW } from '../../lib/driving/cameraModes'
import { HudMenu } from './HudMenu'

const CAMERA_LABEL_KEYS = {
  'first-person': 'driving.camera.firstPerson',
  chase: 'driving.camera.chase',
}

// The driving HUD's toolbar, shared by every driving composition (the course,
// components/DrivingSimulationViewer.jsx, and the cab inspection,
// components/inspection/CabInspectionViewer.jsx). One row at every width the
// app supports: reset, the view, the proximity inset where the composition
// has one, and a More menu for the rest. The camera's arrow moves are the
// arrow keys and the wheel's D-pad (and mouse drag), listed in the
// dashboard's Controls drawer.
//
// `view` is hooks/useDrivingView.js's. The authoring tools (Free camera,
// Colliders) show for `isAdmin`, which follows content.edit.
export function DrivingHudActions({ view, isAdmin, onReset, onWheelSetup, showColliders, onToggleColliders, showInsetToggle = true }) {
  const t = useT()
  const { cameraState, shot, moveCamera, insetOn, toggleInset } = view

  return (
    <div className="driving-hud-actions">
      <button type="button" className="driving-reset-button" onClick={onReset}>
        <RotateCcw size={14} aria-hidden="true" /> {t('driving.hud.resetAttempt')}
      </button>
      <div className="driving-camera-modes" role="group" aria-label={t('driving.camera.label')} title={t('driving.camera.hint')}>
        {CAMERA_VIEWS.map((cameraView) => (
          <button
            key={cameraView}
            type="button"
            className={`driving-reset-button ${cameraState.view === cameraView ? 'is-active' : ''}`}
            aria-pressed={cameraState.view === cameraView}
            onClick={() => moveCamera(`view:${cameraView}`)}
          >
            {t(CAMERA_LABEL_KEYS[cameraView])}
          </button>
        ))}
      </div>
      {showInsetToggle && (
        <button
          type="button"
          className={`driving-reset-button driving-icon-button ${insetOn ? 'is-active' : ''}`}
          aria-pressed={insetOn}
          aria-label={t('driving.inset.toggle')}
          title={t('driving.inset.toggle')}
          onClick={toggleInset}
        >
          <Radar size={16} aria-hidden="true" />
        </button>
      )}
      <HudMenu
        label={t('driving.hud.more')}
        items={[
          { id: 'wheel', label: t('controller.open'), icon: Gamepad2, onSelect: onWheelSetup },
          ...(shot === 'behind'
            ? [{ id: 'reset-camera', label: t('driving.hud.resetCamera'), icon: Locate, onSelect: view.resetCamera }]
            : []),
          ...(isAdmin
            ? [
                {
                  id: 'free-camera',
                  label: t('driving.camera.freeCamera'),
                  icon: Compass,
                  checked: shot === FREE_CAMERA_VIEW,
                  onSelect: () => moveCamera(`view:${shot === FREE_CAMERA_VIEW ? DEFAULT_CAMERA_VIEW : FREE_CAMERA_VIEW}`),
                },
                { id: 'colliders', label: t('driving.hud.showColliders'), icon: Box, checked: showColliders, onSelect: onToggleColliders },
              ]
            : []),
        ]}
      />
    </div>
  )
}
