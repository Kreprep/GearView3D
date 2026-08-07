import { OBJECT_LABELS } from '../../lib/courseEdit'

const RAD_PER_DEG = Math.PI / 180

function NumberField({ label, value, step = 0.1, onChange }) {
  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
    </label>
  )
}

function TextField({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

// Rotations are stored in radians (three.js) but edited in degrees.
function AngleField({ label, value, onChange }) {
  return (
    <NumberField
      label={`${label} (deg)`}
      step={5}
      value={Math.round(((value || 0) * 180) / Math.PI)}
      onChange={(degrees) => onChange((degrees || 0) * RAD_PER_DEG)}
    />
  )
}

function CourseInspector({ item, onChange, onMove, onDelete }) {
  if (!item) {
    return <p className="admin-panel-note">Select an object on the map, or pick a tool and click to place one.</p>
  }

  const { kind, entry } = item
  const set = (patch) => onChange(patch)

  return (
    <div className="course-inspector">
      <p className="course-inspector-kind">{OBJECT_LABELS[kind] || kind}</p>

      <div className="course-inspector-grid">
        <NumberField label="X" value={item.x} onChange={(x) => onMove(x ?? 0, item.z)} />
        <NumberField label="Z" value={item.z} onChange={(z) => onMove(item.x, z ?? 0)} />
      </div>

      {kind === 'start' && <AngleField label="Heading" value={entry.heading} onChange={(heading) => set({ heading })} />}

      {kind === 'wall' && (
        <>
          <NumberField label="Length" value={entry.length ?? 3} onChange={(length) => set({ length })} />
          <AngleField label="Rotation" value={entry.rotation} onChange={(rotation) => set({ rotation })} />
        </>
      )}

      {kind === 'forklift' && (
        <AngleField label="Rotation" value={entry.rotation} onChange={(rotation) => set({ rotation })} />
      )}

      {kind === 'pallet' && (
        <>
          <TextField label="Id" value={entry.id} onChange={(id) => set({ id })} />
          <AngleField label="Rotation" value={entry.rotation} onChange={(rotation) => set({ rotation })} />
          <NumberField
            label="Weight (kg)"
            step={50}
            value={entry.weightKg}
            onChange={(weightKg) => set({ weightKg })}
          />
          <p className="admin-panel-note">
            Weight is shown on the pallet and checked against the course capacity. Over capacity tips the forklift.
          </p>
        </>
      )}

      {kind === 'checkpoint' && (
        <>
          <TextField label="Id" value={entry.id} onChange={(id) => set({ id })} />
          <TextField label="Label" value={entry.label} onChange={(label) => set({ label })} />
          <label>
            Requirement
            <select value={entry.type || 'pass'} onChange={(event) => set({ type: event.target.value })}>
              <option value="pass">Pass through</option>
              <option value="stop">Stop inside</option>
            </select>
          </label>
          <label>
            Shape
            <select
              value={entry.shape === 'line' ? 'line' : 'radius'}
              onChange={(event) =>
                set(
                  event.target.value === 'line'
                    ? { shape: 'line', halfWidth: entry.halfWidth ?? 3, lineDepth: entry.lineDepth ?? 1.4 }
                    : { shape: undefined, radius: entry.radius ?? 0.9 },
                )
              }
            >
              <option value="radius">Circle</option>
              <option value="line">Finish line</option>
            </select>
          </label>
          {entry.shape === 'line' ? (
            <>
              <NumberField label="Half width" value={entry.halfWidth ?? 3} onChange={(halfWidth) => set({ halfWidth })} />
              <NumberField label="Line depth" value={entry.lineDepth ?? 1.4} onChange={(lineDepth) => set({ lineDepth })} />
            </>
          ) : (
            <NumberField label="Radius" value={entry.radius ?? 0.9} onChange={(radius) => set({ radius })} />
          )}
          {entry.type === 'stop' && (
            <NumberField
              label="Max speed to count"
              step={0.05}
              value={entry.maxSpeed ?? 0.25}
              onChange={(maxSpeed) => set({ maxSpeed })}
            />
          )}
          <label>
            Message on clear
            <textarea
              rows={2}
              value={entry.completeMessage || ''}
              onChange={(event) => set({ completeMessage: event.target.value })}
            />
          </label>
          <p className="admin-panel-note">Checkpoints must be cleared in list order - reorder them in the Objects list.</p>
        </>
      )}

      {kind === 'dropZone' && (
        <>
          <TextField label="Label" value={entry.label} onChange={(label) => set({ label })} />
          <NumberField label="Radius" value={entry.radius ?? 0.9} onChange={(radius) => set({ radius })} />
        </>
      )}

      {kind === 'parkingBay' && (
        <>
          <TextField label="Label" value={entry.label} onChange={(label) => set({ label })} />
          <div className="course-inspector-grid">
            <NumberField label="Width" step={0.05} value={entry.width ?? 0.45} onChange={(width) => set({ width })} />
            <NumberField label="Depth" step={0.05} value={entry.depth ?? 1} onChange={(depth) => set({ depth })} />
          </div>
          <AngleField label="Heading" value={entry.heading} onChange={(heading) => set({ heading })} />
          <p className="admin-panel-note">
            The bay must be wider than the forklift or it can never be parked in. Completion also needs the forklift
            stopped, aligned to this heading, forks lowered and the engine off.
          </p>
        </>
      )}

      {kind !== 'start' && (
        <button type="button" className="course-danger" onClick={onDelete}>
          Delete object
        </button>
      )}
    </div>
  )
}

export default CourseInspector
