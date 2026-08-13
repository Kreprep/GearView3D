import { useMemo, useState } from 'react'
import { HUB_CONTENT_FIELDS } from '../../data/hubContent'
import { hubContentContext, hubContentDefault } from '../../lib/hubContent'
import { adminUpdateEquipment } from '../../lib/api'

// Field editor for Equipment.content - the copy on this equipment's training
// hub and module list. Every input is optional: the placeholder shows the
// coded default that renders when the field is left blank, and clearing a
// field is how an admin goes back to that default.
//
// Mount this with key={equipment.id} - the draft is seeded from the row once,
// so switching equipment has to remount rather than resync (which would also
// throw away unsaved edits on every refetch).
function HubContentEditor({ equipment, moduleTitles = [], hasPartsPage = false, onSaved, onMessage }) {
  const [draft, setDraft] = useState(() => equipment?.content || {})
  const [saving, setSaving] = useState(false)

  const context = useMemo(
    () => hubContentContext({
      equipmentTitle: equipment?.title || 'Equipment',
      isForklift: equipment?.id === 'forklift',
      hasPartsPage,
      moduleTitles,
    }),
    [equipment, hasPartsPage, moduleTitles],
  )

  if (!equipment) return <p className="admin-panel-note">Select an equipment to edit its hub copy.</p>

  const sections = HUB_CONTENT_FIELDS.reduce((grouped, field) => {
    grouped[field.section] = [...(grouped[field.section] || []), field]
    return grouped
  }, {})

  const overrideCount = Object.values(draft).filter((value) => typeof value === 'string' && value.trim()).length

  const save = async () => {
    setSaving(true)
    try {
      const result = await adminUpdateEquipment(equipment.id, { content: draft })
      onSaved?.(result.equipment)
      onMessage?.('Hub content saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="admin-panel-note">
        Copy shown on {equipment.title}&apos;s training hub and module list. Leave a field blank to use the
        default in the placeholder. <code>{'{equipment}'}</code> and <code>{'{learner}'}</code> are replaced
        with the equipment title and the signed-in learner&apos;s name.
      </p>

      {Object.entries(sections).map(([section, fields]) => (
        <fieldset key={section} className="admin-fieldset">
          <legend>{section}</legend>
          {fields.map((field) => {
            const value = typeof draft[field.key] === 'string' ? draft[field.key] : ''
            const placeholder = hubContentDefault(field.key, context)
            const onChange = (event) => setDraft({ ...draft, [field.key]: event.target.value })

            return (
              <label key={field.key}>
                {field.label}
                {field.multiline
                  ? <textarea value={value} placeholder={placeholder} onChange={onChange} />
                  : <input value={value} placeholder={placeholder} onChange={onChange} />}
              </label>
            )
          })}
        </fieldset>
      ))}

      <div className="admin-row-actions">
        <button className="admin-save" onClick={save} disabled={saving}>Save hub content</button>
        <button onClick={() => setDraft({})} disabled={overrideCount === 0}>Reset all to default</button>
      </div>
      <p className="admin-panel-note">
        {overrideCount === 0
          ? 'No overrides - every field is using its default.'
          : `${overrideCount} field${overrideCount === 1 ? '' : 's'} overridden.`}
      </p>
    </>
  )
}

export default HubContentEditor
