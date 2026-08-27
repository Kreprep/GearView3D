import { useState } from 'react'
import {
  adminCreateChecklistItem,
  adminDeleteChecklistItem,
  adminUpdateChecklistItem,
} from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'

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
    <section className="admin-panel admin-editor">
      <h3>Checklist Items</h3>
      <p className="admin-panel-note">
        What the learner ticks off on this step. Completion feeds the module percentage but never blocks Next.
      </p>

      {moduleItems.map((item) => (
        <div key={item.id} className="admin-row-actions">
          <input defaultValue={item.text} onBlur={(event) => saveItem(item, event.target.value)} />
          <button onClick={() => removeItem(item)}>Delete</button>
        </div>
      ))}
      {moduleItems.length === 0 && <p className="admin-panel-note">No checklist items yet.</p>}

      <label>
        New checklist item
        <input value={newText} onChange={(event) => setNewText(event.target.value)} placeholder="Check the tyres for damage" />
      </label>
      <button className="admin-save" onClick={addItem} disabled={!newText.trim()}>Add item</button>
    </section>
  )
}

export default ChecklistAdmin
