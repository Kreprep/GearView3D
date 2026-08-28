import { useMemo, useState } from 'react'
import { HUB_CONTENT_FIELDS } from '../../data/hubContent'
import { hubContentContext, hubContentDefault } from '../../lib/hubContent'
import { adminUpdateEquipment } from '../../lib/api'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

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
      hasPartsPage,
      moduleTitles,
    }),
    [equipment, hasPartsPage, moduleTitles],
  )

  if (!equipment) return <PanelNote>Select an equipment to edit its hub copy.</PanelNote>

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
      <PanelNote>
        Copy shown on {equipment.title}&apos;s training hub and module list. Leave a field blank to use the
        default in the placeholder. <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{equipment}'}</code>{' '}
        and <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{learner}'}</code> are replaced with the
        equipment title and the signed-in learner&apos;s name.
      </PanelNote>

      <div className="mt-3 grid gap-3.5">
        {Object.entries(sections).map(([section, fields]) => (
          <fieldset
            key={section}
            className="m-0 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] items-start gap-3 rounded-xl border border-border bg-slate-50 p-4"
          >
            <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-body">{section}</legend>
            {fields.map((field) => {
              const value = typeof draft[field.key] === 'string' ? draft[field.key] : ''
              const placeholder = hubContentDefault(field.key, context)
              const onChange = (event) => setDraft({ ...draft, [field.key]: event.target.value })

              return (
                <Field key={field.key} label={field.label}>
                  {field.multiline
                    ? <Textarea rows={3} value={value} placeholder={placeholder} onChange={onChange} />
                    : <Input value={value} placeholder={placeholder} onChange={onChange} />}
                </Field>
              )
            })}
          </fieldset>
        ))}
      </div>

      <Toolbar>
        <Button onClick={save} disabled={saving}>Save hub content</Button>
        <Button variant="secondary" onClick={() => setDraft({})} disabled={overrideCount === 0}>Reset all to default</Button>
      </Toolbar>
      <PanelNote>
        {overrideCount === 0
          ? 'No overrides - every field is using its default.'
          : `${overrideCount} field${overrideCount === 1 ? '' : 's'} overridden.`}
      </PanelNote>
    </>
  )
}

export default HubContentEditor
