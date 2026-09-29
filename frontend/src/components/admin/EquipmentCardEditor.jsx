import { useState } from 'react'
import { adminUpdateEquipment } from '../../lib/api'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

// Editor for the Equipment row's own fields: the title every {equipment} token
// resolves to, and the artwork on the training hub's header plate. Same shape
// as HubContentEditor and VehicleProfileEditor - a local draft seeded from the
// row once, on mount, saved with one PATCH.
function EquipmentCardEditor({ equipment, onSaved, onMessage }) {
  const [draft, setDraft] = useState(() => ({
    title: equipment?.title || '',
    imageUrl: equipment?.imageUrl || '',
  }))
  const [saving, setSaving] = useState(false)

  if (!equipment) return <PanelNote>The equipment row has not been seeded, so there is nothing to edit.</PanelNote>

  const save = async () => {
    if (!draft.title.trim()) {
      onMessage?.('The title cannot be blank.')
      return
    }

    setSaving(true)
    try {
      const result = await adminUpdateEquipment({ title: draft.title.trim(), imageUrl: draft.imageUrl.trim() })
      onSaved?.(result.equipment)
      onMessage?.('Equipment saved.')
    } catch (error) {
      onMessage?.(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PanelNote>The title and artwork learners see on the training hub.</PanelNote>
      <div className="mt-3.5 grid gap-3.5">
        <Field label="Title" note={<>Replaces <code>{'{equipment}'}</code> in the hub copy and page titles.</>}>
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field
          label="Hub artwork image URL"
          note={<>The line drawing etched into the training hub&apos;s header plate. Drop the file in <code>frontend/public/images/</code> and point at it as <code>/images/your-file.png</code>, or paste any image URL. Left blank, the plate shows no artwork.</>}
        >
          <Input
            value={draft.imageUrl}
            placeholder="/images/forklift-card.png"
            onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
          />
        </Field>
        <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-lg border border-border bg-ink">
          {draft.imageUrl ? (
            <img
              className="h-full w-full object-cover data-[broken=true]:object-contain data-[broken=true]:opacity-40"
              src={draft.imageUrl}
              alt=""
              onError={(event) => { event.currentTarget.dataset.broken = 'true' }}
              onLoad={(event) => { delete event.currentTarget.dataset.broken }}
            />
          ) : (
            <span className="text-sm text-slate-400">No image set</span>
          )}
        </div>
        <Toolbar>
          <Button onClick={save} disabled={saving}>Save</Button>
        </Toolbar>
      </div>
    </>
  )
}

export default EquipmentCardEditor
