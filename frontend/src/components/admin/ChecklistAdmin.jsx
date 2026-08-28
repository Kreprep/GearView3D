import { useState } from 'react'
import {
  adminCreateChecklistItem,
  adminDeleteChecklistItem,
  adminUpdateChecklistItem,
} from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

// One module's checklist items, edited inside its checklist step. Short lines
// of text with no learner-visible body, so they save immediately.
function ChecklistAdmin({ moduleId, items, onItemsChanged, onMessage }) {
  const [newText, setNewText] = useState('')
  const { run } = useAdminAction(onMessage)

  const moduleItems = items
    .filter((item) => String(item.moduleId) === String(moduleId))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const addItem = async () => {
    if (!newText.trim()) return
    const result = await run(
      () => adminCreateChecklistItem({ moduleId, text: newText.trim() }),
      'Checklist item added.',
    )
    if (!result) return
    onItemsChanged([...items, result.item])
    setNewText('')
  }

  const saveItem = async (item, text) => {
    const result = await run(() => adminUpdateChecklistItem(item.id, { text }), null)
    if (!result) return
    onItemsChanged(items.map((entry) => (entry.id === item.id ? result.item : entry)))
  }

  const removeItem = async (item) => {
    if (!window.confirm('Delete this checklist item?')) return
    const result = await run(() => adminDeleteChecklistItem(item.id), 'Checklist item deleted.')
    if (!result) return
    onItemsChanged(items.filter((entry) => entry.id !== item.id))
  }

  return (
    <Panel>
      <PanelHeader>Checklist Items</PanelHeader>
      <PanelNote>
        What the learner ticks off on this step. Completion feeds the module percentage but never blocks Next.
      </PanelNote>

      <div className="mt-3 grid gap-2">
        {moduleItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input defaultValue={item.text} onBlur={(event) => saveItem(item, event.target.value)} />
            <Button type="button" size="sm" variant="danger" onClick={() => removeItem(item)}>Delete</Button>
          </div>
        ))}
      </div>
      {moduleItems.length === 0 && <PanelNote className="mt-2">No checklist items yet.</PanelNote>}

      <Field label="New checklist item" className="mt-3">
        <Input value={newText} onChange={(event) => setNewText(event.target.value)} placeholder="Check the tyres for damage" />
      </Field>
      <Toolbar>
        <Button type="button" onClick={addItem} disabled={!newText.trim()}>Add item</Button>
      </Toolbar>
    </Panel>
  )
}

export default ChecklistAdmin
