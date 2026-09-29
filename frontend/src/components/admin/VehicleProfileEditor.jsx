import { useState } from 'react'
import { defaultVehicleProfile } from '../../data/vehicleProfile'
import { useLanguage } from '../../i18n'
import { resolveVehicleProfile } from '../../lib/vehicleProfile'
import { adminUpdateEquipment } from '../../lib/api'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

const FIELDSET_CLASSES = 'm-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4'
const LEGEND_CLASSES = 'px-1 text-[13px] font-bold text-body'

// The simConfig keys resolveVehicleProfile() still reads. The draft starts from
// these alone, so saving drops anything a row kept from before the app was
// narrowed to the forklift (model URLs, `hasForks`, rig node names) instead of
// writing it back. keyLegend and failMessages have no fields here but are
// still honoured, so they are carried through untouched.
function editableOverrides(simConfig) {
  const overrides = {}
  if (!simConfig) return overrides
  if (simConfig.footprint) overrides.footprint = simConfig.footprint
  if (simConfig.rig?.cabin) overrides.rig = { cabin: simConfig.rig.cabin }
  if (simConfig.keyLegend) overrides.keyLegend = simConfig.keyLegend
  if (simConfig.failMessages) overrides.failMessages = simConfig.failMessages
  return overrides
}

// Editor for Equipment.simConfig - how the forklift drives in a `driving`
// step. Only overrides are stored, so a blank field keeps the coded default
// shown as its placeholder, exactly like the hub content editor.
//
// The draft is seeded from the row once, on mount.
function VehicleProfileEditor({ equipment, onSaved, onMessage }) {
  // The placeholders show the coded defaults, so they follow the dashboard's
  // language. simConfig overrides themselves stay single-language.
  const language = useLanguage()
  const [draft, setDraft] = useState(() => editableOverrides(equipment?.simConfig))
  const [saving, setSaving] = useState(false)

  if (!equipment) return <PanelNote>The equipment row has not been seeded, so there is no profile to edit.</PanelNote>

  const defaults = defaultVehicleProfile(language)
  const resolved = resolveVehicleProfile(equipment, language)
  const setFootprint = (patch) => setDraft({ ...draft, footprint: { ...(draft.footprint || {}), ...patch } })
  const setSeatAxis = (axis, value) => {
    const next = [...(draft.rig?.cabin?.seatOffset ?? resolved.rig.cabin.seatOffset)]
    next[axis] = value
    setDraft({ ...draft, rig: { cabin: { ...(draft.rig?.cabin || {}), seatOffset: next } } })
  }

  const save = async () => {
    setSaving(true)
    try {
      const result = await adminUpdateEquipment({ simConfig: draft })
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
        How the forklift behaves in a Driving Course step. Leave a field blank to use the default in its placeholder.
      </PanelNote>

      <div className="mt-3 grid gap-3.5">
        <fieldset className={FIELDSET_CLASSES}>
          <legend className={LEGEND_CLASSES}>Body footprint (metres, half-extents)</legend>
          <Field label="Half width">
            <Input
              type="number"
              step="0.01"
              value={draft.footprint?.halfWidth ?? ''}
              placeholder={String(defaults.footprint.halfWidth)}
              onChange={(event) => setFootprint({ halfWidth: event.target.value === '' ? undefined : Number(event.target.value) })}
            />
          </Field>
          <Field label="Half length">
            <Input
              type="number"
              step="0.01"
              value={draft.footprint?.halfLength ?? ''}
              placeholder={String(defaults.footprint.halfLength)}
              onChange={(event) => setFootprint({ halfLength: event.target.value === '' ? undefined : Number(event.target.value) })}
            />
          </Field>
          <PanelNote className="col-span-full">
            Used for cone, wall, rack and pallet collision. The default is the forklift&apos;s body without the forks,
            which have to stay outside it or the tines cannot slide under a pallet. Too small and the forklift clips
            through; too large and it fails on clearances a real one would make.
          </PanelNote>
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
        {overrideCount === 0 ? 'No overrides - the forklift drives with the default profile.' : `${overrideCount} group(s) overridden.`}
      </PanelNote>
    </>
  )
}

export default VehicleProfileEditor
