import { useState } from 'react'
import { defaultVehicleProfile } from '../../data/vehicleProfile'
import { resolveVehicleProfile } from '../../lib/vehicleProfile'
import { adminUpdateEquipment } from '../../lib/api'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Checkbox } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

const FIELDSET_CLASSES = 'm-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4'
const LEGEND_CLASSES = 'px-1 text-xs font-extrabold uppercase tracking-wider text-body'

// Editor for Equipment.simConfig - how this equipment drives in a `driving`
// step. Only overrides are stored, so a blank field keeps the coded default
// shown as its placeholder, exactly like the hub content editor.
//
// Mount with key={equipment.id}: the draft is seeded from the row once.
function VehicleProfileEditor({ equipment, onSaved, onMessage }) {
  const [draft, setDraft] = useState(() => equipment?.simConfig || {})
  const [saving, setSaving] = useState(false)

  if (!equipment) return <PanelNote>Select an equipment first.</PanelNote>

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
      <PanelNote>
        How this equipment behaves in a Driving Course step. Leave a field blank to use the default in its
        placeholder. An equipment with no model of its own drives the forklift model; one whose model has none of
        the rig node names below still drives, just without spinning wheels or a moving mast.
      </PanelNote>

      <div className="mt-3 grid gap-3.5">
        <fieldset className={FIELDSET_CLASSES}>
          <legend className={LEGEND_CLASSES}>Vehicle</legend>
          <Field label="Driving model URL">
            <Input
              value={draft.modelUrl || ''}
              placeholder={resolved.modelUrl}
              onChange={(event) => setField({ modelUrl: event.target.value })}
            />
          </Field>
          <Field label="Parked-obstacle model URL">
            <Input
              value={draft.parkedModelUrl || ''}
              placeholder={resolved.parkedModelUrl}
              onChange={(event) => setField({ parkedModelUrl: event.target.value })}
            />
          </Field>
          <Checkbox
            label="This vehicle has forks"
            className="col-span-full"
            checked={draft.hasForks !== undefined ? Boolean(draft.hasForks) : defaults.hasForks}
            onChange={(event) => setField({ hasForks: event.target.checked })}
          />
          <PanelNote className="col-span-full">Unchecked hides the raise/lower keys from the HUD legend and help line.</PanelNote>
        </fieldset>

        <fieldset className={FIELDSET_CLASSES}>
          <legend className={LEGEND_CLASSES}>Body footprint (metres, half-extents)</legend>
          <Field label="Half width">
            <Input
              type="number"
              step="0.01"
              value={draft.footprint?.halfWidth ?? ''}
              placeholder={String(resolved.footprint.halfWidth)}
              onChange={(event) => setFootprint({ halfWidth: event.target.value === '' ? undefined : Number(event.target.value) })}
            />
          </Field>
          <Field label="Half length">
            <Input
              type="number"
              step="0.01"
              value={draft.footprint?.halfLength ?? ''}
              placeholder={String(resolved.footprint.halfLength)}
              onChange={(event) => setFootprint({ halfLength: event.target.value === '' ? undefined : Number(event.target.value) })}
            />
          </Field>
          <PanelNote className="col-span-full">
            Used for cone and wall collision. Too small and the vehicle clips through; too large and it fails on
            clearances a real one would make.
          </PanelNote>
        </fieldset>

        <fieldset className={FIELDSET_CLASSES}>
          <legend className={LEGEND_CLASSES}>Rig node names (from the GLB)</legend>
          {['FL', 'FR', 'RL', 'RR'].map((wheel) => (
            <Field key={wheel} label={`${wheel} wheel`}>
              <Input
                value={draft.rig?.wheels?.[wheel] || ''}
                placeholder={resolved.rig.wheels[wheel]}
                onChange={(event) => setWheels({ [wheel]: event.target.value })}
              />
            </Field>
          ))}
          <Field label="Mast node">
            <Input value={draft.rig?.mast || ''} placeholder={resolved.rig.mast} onChange={(event) => setRig({ mast: event.target.value })} />
          </Field>
          <Field label="Lift carriage node">
            <Input value={draft.rig?.carriage || ''} placeholder={resolved.rig.carriage} onChange={(event) => setRig({ carriage: event.target.value })} />
          </Field>
          <PanelNote className="col-span-full">A name that does not exist in the model is skipped rather than failing the scene.</PanelNote>
        </fieldset>

        <fieldset className={FIELDSET_CLASSES}>
          <legend className={LEGEND_CLASSES}>Cabin (first-person seat, metres, local to the vehicle)</legend>
          {[['Side (x)', 0], ['Height (y)', 1], ['Forward (z)', 2]].map(([label, axis]) => (
            <Field key={axis} label={label}>
              <Input
                type="number"
                step="0.01"
                value={draft.rig?.cabin?.seatOffset?.[axis] ?? ''}
                placeholder={String(resolved.rig.cabin.seatOffset[axis])}
                onChange={(event) => setSeatAxis(axis, event.target.value === '' ? resolved.rig.cabin.seatOffset[axis] : Number(event.target.value))}
              />
            </Field>
          ))}
          <PanelNote className="col-span-full">
            Where the first-person camera sits: sideways, up, and forward from the vehicle&apos;s centre. Test it by
            driving the course with First-Person on.
          </PanelNote>
        </fieldset>
      </div>

      <Toolbar>
        <Button onClick={save} disabled={saving}>Save vehicle profile</Button>
        <Button variant="secondary" onClick={() => setDraft({})} disabled={overrideCount === 0}>Reset to default</Button>
      </Toolbar>
      <PanelNote>
        {overrideCount === 0 ? 'No overrides - this equipment drives with the default profile.' : `${overrideCount} group(s) overridden.`}
      </PanelNote>
    </>
  )
}

export default VehicleProfileEditor
