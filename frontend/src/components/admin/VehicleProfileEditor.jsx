import { useState } from 'react'
import { defaultVehicleProfile } from '../../data/vehicleProfile'
import { resolveVehicleProfile } from '../../lib/vehicleProfile'
import { adminUpdateEquipment } from '../../lib/api'

// Editor for Equipment.simConfig - how this equipment drives in a `driving`
// step. Only overrides are stored, so a blank field keeps the coded default
// shown as its placeholder, exactly like the hub content editor.
//
// Mount with key={equipment.id}: the draft is seeded from the row once.
function VehicleProfileEditor({ equipment, onSaved, onMessage }) {
  const [draft, setDraft] = useState(() => equipment?.simConfig || {})
  const [saving, setSaving] = useState(false)

  if (!equipment) return <p className="admin-panel-note">Select an equipment first.</p>

  const defaults = defaultVehicleProfile()
  const resolved = resolveVehicleProfile(equipment)
  const setField = (patch) => setDraft({ ...draft, ...patch })
  const setRig = (patch) => setField({ rig: { ...(draft.rig || {}), ...patch } })
  const setWheels = (patch) => setRig({ wheels: { ...(draft.rig?.wheels || {}), ...patch } })
  const setFootprint = (patch) => setField({ footprint: { ...(draft.footprint || {}), ...patch } })
  const setSeatAxis = (axis, value) => {
    const current = draft.rig?.cabin?.seatOffset ?? resolved.rig.cabin.seatOffset
    const next = [...current]
    next[axis] = value
    setRig({ cabin: { ...(draft.rig?.cabin || {}), seatOffset: next } })
  }

  const save = async () => {
    setSaving(true)
    try {
      const result = await adminUpdateEquipment(equipment.id, { simConfig: draft })
      onSaved?.(result.equipment)
      onMessage?.('Vehicle profile saved.')
    } catch (error) {
      onMessage?.(error.message)
    } finally {
      setSaving(false)
    }
  }

  const overrideCount = Object.keys(draft).length

  return (
    <>
      <p className="admin-panel-note">
        How this equipment behaves in a Driving Course step. Leave a field blank to use the default in its
        placeholder. An equipment with no model of its own drives the forklift model; one whose model has none of
        the rig node names below still drives, just without spinning wheels or a moving mast.
      </p>

      <fieldset className="admin-fieldset">
        <legend>Vehicle</legend>
        <label>
          Driving model URL
          <input
            value={draft.modelUrl || ''}
            placeholder={resolved.modelUrl}
            onChange={(event) => setField({ modelUrl: event.target.value })}
          />
        </label>
        <label>
          Parked-obstacle model URL
          <input
            value={draft.parkedModelUrl || ''}
            placeholder={resolved.parkedModelUrl}
            onChange={(event) => setField({ parkedModelUrl: event.target.value })}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={draft.hasForks !== undefined ? Boolean(draft.hasForks) : defaults.hasForks}
            onChange={(event) => setField({ hasForks: event.target.checked })}
          />
          This vehicle has forks
        </label>
        <p className="admin-panel-note">Unchecked hides the raise/lower keys from the HUD legend and help line.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Body footprint (metres, half-extents)</legend>
        <label>
          Half width
          <input
            type="number"
            step="0.01"
            value={draft.footprint?.halfWidth ?? ''}
            placeholder={String(resolved.footprint.halfWidth)}
            onChange={(event) => setFootprint({ halfWidth: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </label>
        <label>
          Half length
          <input
            type="number"
            step="0.01"
            value={draft.footprint?.halfLength ?? ''}
            placeholder={String(resolved.footprint.halfLength)}
            onChange={(event) => setFootprint({ halfLength: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </label>
        <p className="admin-panel-note">Used for cone and wall collision. Too small and the vehicle clips through; too large and it fails on clearances a real one would make.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Rig node names (from the GLB)</legend>
        {['FL', 'FR', 'RL', 'RR'].map((wheel) => (
          <label key={wheel}>
            {wheel} wheel
            <input
              value={draft.rig?.wheels?.[wheel] || ''}
              placeholder={resolved.rig.wheels[wheel]}
              onChange={(event) => setWheels({ [wheel]: event.target.value })}
            />
          </label>
        ))}
        <label>
          Mast node
          <input value={draft.rig?.mast || ''} placeholder={resolved.rig.mast} onChange={(event) => setRig({ mast: event.target.value })} />
        </label>
        <label>
          Lift carriage node
          <input value={draft.rig?.carriage || ''} placeholder={resolved.rig.carriage} onChange={(event) => setRig({ carriage: event.target.value })} />
        </label>
        <p className="admin-panel-note">A name that does not exist in the model is skipped rather than failing the scene.</p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Cabin (first-person seat, metres, local to the vehicle)</legend>
        {[['Side (x)', 0], ['Height (y)', 1], ['Forward (z)', 2]].map(([label, axis]) => (
          <label key={axis}>
            {label}
            <input
              type="number"
              step="0.01"
              value={draft.rig?.cabin?.seatOffset?.[axis] ?? ''}
              placeholder={String(resolved.rig.cabin.seatOffset[axis])}
              onChange={(event) => setSeatAxis(axis, event.target.value === '' ? resolved.rig.cabin.seatOffset[axis] : Number(event.target.value))}
            />
          </label>
        ))}
        <p className="admin-panel-note">Where the first-person camera sits: sideways, up, and forward from the vehicle's centre. Test it by driving the course with First-Person on.</p>
      </fieldset>

      <div className="admin-row-actions">
        <button className="admin-save" onClick={save} disabled={saving}>Save vehicle profile</button>
        <button onClick={() => setDraft({})} disabled={overrideCount === 0}>Reset to default</button>
      </div>
      <p className="admin-panel-note">
        {overrideCount === 0 ? 'No overrides - this equipment drives with the default profile.' : `${overrideCount} group(s) overridden.`}
      </p>
    </>
  )
}

export default VehicleProfileEditor
