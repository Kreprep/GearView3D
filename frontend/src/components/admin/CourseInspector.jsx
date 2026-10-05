import { OBJECT_LABELS } from '../../lib/courseEdit'
import { RACK_LEVEL_LABELS, RACK_LEVELS } from '../../data/rackProfile'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Checkbox, Input, Textarea, Select } from '../ui/input'

const RAD_PER_DEG = Math.PI / 180

function NumberField({ label, value, step = 0.1, onChange }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
    </Field>
  )
}

function TextField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </Field>
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

function CourseInspector({ item, racks = [], onChange, onMove, onDelete }) {
  if (!item) {
    return <PanelNote>Select an object on the map, or pick a tool and click to place one.</PanelNote>
  }

  const { kind, entry } = item
  const set = (patch) => onChange(patch)

  return (
    <div className="grid gap-2">
      <p className="m-0 font-semibold text-ink">{OBJECT_LABELS[kind] || kind}</p>

      <div className="grid grid-cols-2 gap-2">
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

      {kind === 'vehicle' && (
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
          <PanelNote>
            Weight is shown on the pallet and checked against the course capacity. Over capacity tips the vehicle.
          </PanelNote>
          <NumberField
            label="Load offset (m)"
            step={0.05}
            value={entry.loadOffsetM}
            onChange={(loadOffsetM) => set({ loadOffsetM: loadOffsetM || undefined })}
          />
          <PanelNote>
            How far the load&apos;s centre of gravity sits from the pallet&apos;s middle, + toward its far side. A load
            further out is derated by the load chart, so the same weight can be over capacity.
          </PanelNote>
          <Field label="Starts on">
            <Select
              value={entry.startShelf?.rack || ''}
              onChange={(event) =>
                set({ startShelf: event.target.value ? { rack: event.target.value, level: entry.startShelf?.level || 'top' } : undefined })
              }
            >
              <option value="">The floor, where it is placed</option>
              {racks.map((rack) => (
                <option key={rack.id} value={rack.id}>Rack {rack.id}</option>
              ))}
            </Select>
          </Field>
          {entry.startShelf && (
            <Field label="Start shelf level">
              <Select value={entry.startShelf.level} onChange={(event) => set({ startShelf: { ...entry.startShelf, level: event.target.value } })}>
                {RACK_LEVELS.map((level) => (
                  <option key={level} value={level}>{RACK_LEVEL_LABELS[level]}</option>
                ))}
              </Select>
            </Field>
          )}
          {entry.startShelf && (
            <PanelNote>The pallet starts in that rack&apos;s centre bay on this shelf; its own position is not used.</PanelNote>
          )}
          <Field label="Target rack">
            <Select
              value={entry.targetRack || ''}
              onChange={(event) =>
                set({ targetRack: event.target.value || undefined, targetLevel: event.target.value ? entry.targetLevel : undefined })
              }
            >
              <option value="">None - deliver to a drop zone instead</option>
              {racks.map((rack) => (
                <option key={rack.id} value={rack.id}>{rack.id}</option>
              ))}
            </Select>
          </Field>
          {entry.targetRack && (
            <Field label="Target shelf level">
              <Select value={entry.targetLevel || ''} onChange={(event) => set({ targetLevel: event.target.value || undefined })}>
                <option value="">Choose a level</option>
                {RACK_LEVELS.map((level) => (
                  <option key={level} value={level}>{RACK_LEVEL_LABELS[level]}</option>
                ))}
              </Select>
            </Field>
          )}
          {entry.targetRack && (
            <PanelNote>
              Raise this pallet to the target level&apos;s height, drive it into that rack, and hold steady to set it down.
              Set the goal type to Rack storage below so the step reads this instead of a drop zone.
            </PanelNote>
          )}
        </>
      )}

      {kind === 'rack' && (
        <>
          <TextField label="Id" value={entry.id} onChange={(id) => set({ id })} />
          <AngleField label="Rotation" value={entry.rotation} onChange={(rotation) => set({ rotation })} />
          <PanelNote>
            Assign a pallet to this rack from that pallet&apos;s own panel (Target rack / Target shelf level). The rack
            itself is not a collider - the vehicle has to reach inside its footprint to place a load.
          </PanelNote>
        </>
      )}

      {(kind === 'rack-empty' || kind === 'rack-loaded' || kind === 'rack-spare') && (
        <>
          <AngleField label="Rotation" value={entry.rotation} onChange={(rotation) => set({ rotation })} />
          <PanelNote>
            Background dressing only - no id, no target, not graded, not a collider. Switch which one this is by
            deleting it and placing the other kind from the palette.
          </PanelNote>
        </>
      )}

      {kind === 'checkpoint' && (
        <>
          <TextField label="Id" value={entry.id} onChange={(id) => set({ id })} />
          <TextField label="Label" value={entry.label} onChange={(label) => set({ label })} />
          <Field label="Requirement">
            <Select value={entry.type || 'pass'} onChange={(event) => set({ type: event.target.value })}>
              <option value="pass">Pass through</option>
              <option value="stop">Stop inside</option>
            </Select>
          </Field>
          <Field label="Shape">
            <Select
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
            </Select>
          </Field>
          {entry.shape === 'line' ? (
            <>
              <NumberField label="Half width" value={entry.halfWidth ?? 3} onChange={(halfWidth) => set({ halfWidth })} />
              <NumberField label="Line depth" value={entry.lineDepth ?? 1.4} onChange={(lineDepth) => set({ lineDepth })} />
            </>
          ) : (
            <NumberField label="Radius" value={entry.radius ?? 0.9} onChange={(radius) => set({ radius })} />
          )}
          <Checkbox
            label="Blind crossing: sound the horn on the way in"
            checked={Boolean(entry.requireHorn)}
            onChange={(event) => set({ requireHorn: event.target.checked || undefined })}
          />
          {entry.type === 'stop' && (
            <NumberField
              label="Max speed to count"
              step={0.05}
              value={entry.maxSpeed ?? 0.25}
              onChange={(maxSpeed) => set({ maxSpeed })}
            />
          )}
          <Field label="Message on clear">
            <Textarea
              rows={2}
              value={entry.completeMessage || ''}
              onChange={(event) => set({ completeMessage: event.target.value })}
            />
          </Field>
          <PanelNote>Checkpoints must be cleared in list order - reorder them in the Objects list.</PanelNote>
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
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" step={0.05} value={entry.width ?? 0.45} onChange={(width) => set({ width })} />
            <NumberField label="Depth" step={0.05} value={entry.depth ?? 1} onChange={(depth) => set({ depth })} />
          </div>
          <AngleField label="Heading" value={entry.heading} onChange={(heading) => set({ heading })} />
          <PanelNote>
            The bay must be wider than the vehicle or it can never be parked in. Completion also needs the vehicle
            stopped, aligned to this heading, forks lowered and the engine off.
          </PanelNote>
        </>
      )}

      {kind !== 'start' && (
        <Button type="button" size="sm" variant="danger" className="justify-self-start" onClick={onDelete}>
          Delete object
        </Button>
      )}
    </div>
  )
}

export default CourseInspector
