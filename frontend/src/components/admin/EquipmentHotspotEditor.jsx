import { useState } from 'react'
import InteractiveForkliftViewer from '../InteractiveForkliftViewer'
import {
  adminDeleteEquipmentHotspot,
  adminPublishEquipmentHotspot,
  adminRevertEquipmentHotspot,
  adminSaveEquipmentHotspotDraft,
} from '../../lib/api'
import './WalkAroundHotspotAdmin.css'

// The equivalent of WalkAroundHotspotEditor for any equipment other than
// Forklift. Same drag-and-place viewer (InteractiveForkliftViewer already
// takes any modelUrl - "Forklift" in its name is legacy, not a constraint),
// simpler fields: no engine-state gating or defect-scenario linkage, since
// there's no equivalent hardcoded simulation flow for other equipment to hook
// into - just a label, category and a markdown description.
function draftOf(hotspot) {
  const source = hotspot.draft || hotspot
  return {
    label: source.label,
    position: source.position || [0, 0.3, 0],
    category: source.category || '',
    description: source.description || '',
  }
}

function EquipmentHotspotEditor({ hotspot, modelUrl, onHotspotChanged, onHotspotDeleted, onMessage }) {
  const [draft, setDraft] = useState(() => draftOf(hotspot))
  const [dirty, setDirty] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [busy, setBusy] = useState(false)

  const resyncFrom = (nextHotspot) => {
    setDraft(draftOf(nextHotspot))
    setDirty(false)
    setPlacing(false)
  }

  const setField = (patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const handlePlaceHotspot = (position) => {
    setField({ position })
    setPlacing(false)
  }

  const handleDragHotspot = (_id, position) => {
    setField({ position })
  }

  const run = async (action, successMessage, { resync = false } = {}) => {
    setBusy(true)
    try {
      const result = await action()
      if (result?.hotspot) {
        onHotspotChanged(result.hotspot)
        setDirty(false)
        if (resync) resyncFrom(result.hotspot)
      }
      onMessage(successMessage)
      return result
    } catch (err) {
      onMessage(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => run(() => adminSaveEquipmentHotspotDraft(hotspot.id, draft), 'Draft saved.')

  const publish = async () => {
    const saved = await run(() => adminSaveEquipmentHotspotDraft(hotspot.id, draft), 'Draft saved.')
    if (!saved) return
    await run(() => adminPublishEquipmentHotspot(hotspot.id), 'Hotspot published - learners see it now.')
  }

  const revert = () => {
    if (!window.confirm('Discard the unpublished draft and go back to the published version?')) return
    return run(() => adminRevertEquipmentHotspot(hotspot.id), 'Draft discarded.', { resync: true })
  }

  const remove = async () => {
    if (!window.confirm(`Delete the hotspot "${draft.label}"? Learners will no longer see it.`)) return
    setBusy(true)
    try {
      await adminDeleteEquipmentHotspot(hotspot.id)
      onHotspotDeleted(hotspot.id)
      onMessage('Hotspot deleted.')
    } catch (err) {
      onMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const previewHotspot = { ...draft, id: hotspot.id }

  return (
    <div className="hotspot-editor">
      <header className="hotspot-editor-bar">
        <div>
          <h2>{draft.label}</h2>
          <p className="hotspot-editor-id">
            {hotspot.id}
            {hotspot.draft && <span className="hotspot-badge draft">Unpublished draft</span>}
            {!hotspot.published && <span className="hotspot-badge unpublished">Not visible to learners</span>}
            {dirty && <span className="hotspot-badge dirty">Unsaved changes</span>}
          </p>
        </div>
        <div className="hotspot-editor-actions">
          <button type="button" onClick={saveDraft} disabled={busy}>Save draft</button>
          <button type="button" className="admin-save" onClick={publish} disabled={busy}>Publish</button>
          {hotspot.draft && <button type="button" onClick={revert} disabled={busy}>Discard draft</button>}
          <button type="button" className="hotspot-danger" onClick={remove} disabled={busy}>Delete hotspot</button>
        </div>
      </header>

      <div className="hotspot-editor-body">
        <section className="hotspot-editor-viewer">
          <button
            type="button"
            className={placing ? 'is-active' : ''}
            onClick={() => setPlacing((value) => !value)}
          >
            {placing ? 'Cancel placement' : 'Place hotspot'}
          </button>
          <div className="hotspot-editor-stage">
            <InteractiveForkliftViewer
              modelUrl={modelUrl}
              isAdmin
              adminEditMode
              placingActive={placing}
              hotspots={[previewHotspot]}
              onPlaceHotspot={handlePlaceHotspot}
              onDragHotspot={handleDragHotspot}
            />
          </div>
          <p className="admin-panel-note">
            Position: {draft.position.map((value) => value.toFixed(3)).join(', ')}
          </p>
        </section>

        <section className="admin-panel hotspot-editor-fields">
          <label>
            Label
            <input value={draft.label} onChange={(event) => setField({ label: event.target.value })} />
          </label>
          <label>
            Category
            <input value={draft.category} onChange={(event) => setField({ category: event.target.value })} />
          </label>
          <label>
            Description (Markdown)
            <textarea rows={8} value={draft.description} onChange={(event) => setField({ description: event.target.value })} />
          </label>
          <p className="admin-panel-note">Supports markdown: **bold**, - bullet points, 1. numbered lists, and inline images via ![alt](/images/example.png).</p>
        </section>
      </div>
    </div>
  )
}

export default EquipmentHotspotEditor
