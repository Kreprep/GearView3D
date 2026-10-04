import { Html } from '@react-three/drei'
import './HotspotMarkers.css'

// The hotspot markers on the truck (one per `Hotspot` row with a position),
// shared by the viewers that draw them: HotspotViewer's walk-around and
// placement stage, and the cab inspection. Positions are in the model's own
// frame, so put the markers in the same group as the model and they ride
// with it.

// A hotspot as the walk-around's defect scenario shows it: safe or unsafe,
// with the matching feedback.
function scenarioResult(hotspot, scenario) {
  const unsafe = (hotspot.unsafeScenarios || []).includes(scenario)

  return {
    ...hotspot,
    result: unsafe ? 'unsafe' : 'safe',
    feedback: unsafe ? hotspot.unsafeFeedback : hotspot.safeFeedback,
  }
}

// One marker: a 24 px button around a 16 px dot, labelled on hover. Its
// group registers in `hotspotRefs` (by id) so a camera can focus it.
export function HotspotMarker({ hotspot, selected, scenario, onSelect, hotspotRefs, adminEditMode, onMarkerPointerDown }) {
  const result = scenarioResult(hotspot, scenario)

  return (
    <group
      position={hotspot.position}
      ref={(node) => {
        if (!hotspotRefs) return
        if (node) hotspotRefs.current.set(hotspot.id, node)
        else hotspotRefs.current.delete(hotspot.id)
      }}
    >
      <Html center zIndexRange={[100, 0]} occlude={false}>
        <div className="hotspot-marker-wrap">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(result)
            }}
            onPointerDown={adminEditMode ? (event) => onMarkerPointerDown?.(hotspot.id, event) : undefined}
            className={`hotspot-marker ${result.result === 'unsafe' ? 'unsafe' : ''} ${selected ? 'selected' : ''} ${adminEditMode ? 'admin-editable' : ''}`}
            aria-label={hotspot.label}
          />
          <span className="hotspot-marker-tooltip">{hotspot.label}</span>
        </div>
      </Html>
    </group>
  )
}

// Every marker in `hotspots`. `onSelect` receives the hotspot with its
// scenario result.
export function HotspotMarkers({ hotspots, selectedHotspotId, scenario, onSelect, hotspotRefs, adminEditMode = false, onMarkerPointerDown }) {
  return hotspots.map((hotspot) => (
    <HotspotMarker
      key={hotspot.id}
      hotspot={hotspot}
      scenario={scenario}
      selected={selectedHotspotId === hotspot.id}
      onSelect={onSelect}
      hotspotRefs={hotspotRefs}
      adminEditMode={adminEditMode}
      onMarkerPointerDown={onMarkerPointerDown}
    />
  ))
}
