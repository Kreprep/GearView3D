import { useState } from 'react'
import InteractiveForkliftViewer from '../InteractiveForkliftViewer'
import {
  adminCreatePart,
  adminDeletePart,
  adminPublishPart,
  adminPublishPartDetail,
  adminRevertPart,
  adminRevertPartDetail,
  adminUpdatePart,
  adminUpdatePartDetail,
} from '../../lib/api'
import './WalkAroundHotspotAdmin.css'

// Forklift's Parts Identification editor - the same list + place-on-the-model
// split the walk-around and equipment hotspot editors use, over `Part` rows
// (which carry a 3D `position`) and their `PartDetail` cards.
//
// The second list holds detail-only ids: walk-around checks like the ignition
// or the horn that have a detail card but are not standalone parts, so they
// have no position to place.

function editableRow(row) {
  if (!row) return row
  return row.draft ? { ...row, ...row.draft } : row
}

function detailFor(part, partDetails) {
  return (
    editableRow(partDetails[part.id]) || {
      id: part.id,
      title: part.label,
      subtitle: part.category || '',
      image: '',
      description: '',
    }
  )
}

function PartHotspotAdmin({ parts, partDetails, categories, modelUrl, onPartsChanged, onPartDetailsChanged, onMessage }) {
  const [selectedId, setSelectedId] = useState(null)
  const [part, setPart] = useState(null)
  const [detail, setDetail] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const sortedParts = [...parts].sort((a, b) => a.sortOrder - b.sortOrder)
  const detailOnly = Object.values(partDetails).filter((entry) => !parts.some((row) => row.id === entry.id))
  const stored = parts.find((entry) => entry.id === selectedId) || null

  const selectPart = (row) => {
    if (row.id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this part?')) return

    setSelectedId(row.id)
    setPart(editableRow(row))
    setDetail(detailFor(row, partDetails))
    setPlacing(false)
    setDirty(false)
  }

  const selectDetailOnly = (entry) => {
    if (entry.id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this part?')) return

    setSelectedId(entry.id)
    setPart(null)
    setDetail(editableRow(entry))
    setPlacing(false)
    setDirty(false)
  }

  const setPartField = (patch) => {
    setPart((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const setDetailField = (patch) => {
    setDetail((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const run = async (action, message) => {
    setBusy(true)
    try {
      const result = await action()
      if (message) onMessage(message)
      return result
    } catch (error) {
      onMessage(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  // Part and detail are saved together: the learner sees one card built from
  // both, so publishing half of it would show a half-updated part.
  const saveDraft = async () => {
    if (part) {
      const result = await run(() => adminUpdatePart(part.id, part), null)
      if (result) onPartsChanged(parts.map((entry) => (entry.id === result.part.id ? result.part : entry)))
    }
    if (detail) {
      const result = await run(() => adminUpdatePartDetail(detail.id, detail), null)
      if (result) onPartDetailsChanged({ ...partDetails, [result.detail.id]: result.detail })
    }
    setDirty(false)
    onMessage('Draft saved. Publish to show it to learners.')
  }

  const publish = async () => {
    await saveDraft()
    let published = false

    if (part) {
      const result = await adminPublishPart(part.id).catch(() => null)
      if (result) {
        onPartsChanged(parts.map((entry) => (entry.id === result.part.id ? result.part : entry)))
        published = true
      }
    }
    if (detail) {
      const result = await adminPublishPartDetail(detail.id).catch(() => null)
      if (result) {
        onPartDetailsChanged({ ...partDetails, [result.detail.id]: result.detail })
        published = true
      }
    }

    onMessage(published ? 'Published - learners see this part now.' : 'Nothing to publish.')
  }

  const revert = async () => {
    if (!window.confirm('Discard the unpublished changes and go back to the published version?')) return

    if (part) {
      const result = await adminRevertPart(part.id).catch(() => null)
      if (result) {
        onPartsChanged(parts.map((entry) => (entry.id === result.part.id ? result.part : entry)))
        setPart(editableRow(result.part))
      }
    }
    if (detail) {
      const result = await adminRevertPartDetail(detail.id).catch(() => null)
      if (result) {
        onPartDetailsChanged({ ...partDetails, [result.detail.id]: result.detail })
        setDetail(editableRow(result.detail))
      }
    }
    setDirty(false)
    onMessage('Draft discarded.')
  }

  const remove = async () => {
    if (!part) return
    if (!window.confirm(`Delete the part "${part.label}"? Learners will no longer see it.`)) return

    const result = await run(() => adminDeletePart(part.id), 'Part deleted.')
    if (!result) return
    onPartsChanged(parts.filter((entry) => entry.id !== part.id))
    setSelectedId(null)
    setPart(null)
    setDetail(null)
  }

  // A new part starts at the middle of the model with its draft already
  // filled in, so nothing reaches learners until it has been placed and
  // published.
  const createPart = async () => {
    if (!newLabel.trim()) return
    const result = await run(
      () => adminCreatePart({ label: newLabel.trim(), position: [0, 0.3, 0], checklist: [] }),
      'Part created. Place it on the model, then Publish.',
    )
    if (!result) return
    onPartsChanged([...parts, result.part])
    selectPart(result.part)
    setNewLabel('')
  }

  const position = part?.position || [0, 0.3, 0]

  // Every part's marker is on the model, not just the selected one: placing a
  // spot is a judgement about where it sits relative to its neighbours. The
  // selected part shows its live (possibly unsaved) position; clicking any
  // other marker switches the editor to it, and dragging moves whichever one
  // is selected.
  const markers = sortedParts.map((row) => {
    const source = editableRow(row)
    return {
      id: row.id,
      label: source.label,
      position: row.id === selectedId && part ? position : source.position || [0, 0.3, 0],
    }
  })

  const handleMarkerSelect = (marker) => {
    const row = parts.find((entry) => entry.id === marker.id)
    if (row) selectPart(row)
  }

  const handleMarkerDrag = (id, next) => {
    // Only the selected marker moves; a drag that starts on another one has
    // already selected it through the click above.
    if (id === selectedId) setPartField({ position: next })
  }

  return (
    <div className="hotspot-admin-body">
      <section className="admin-panel hotspot-list-panel">
        <h2>Forklift Parts</h2>
        <p className="admin-panel-note">
          Every labelled part on the model. Select one to reposition its marker or edit its detail card.
        </p>

        <ol className="hotspot-list">
          {sortedParts.map((row) => (
            <li key={row.id} className={row.id === selectedId ? 'is-selected' : ''}>
              <button type="button" className="hotspot-list-name" onClick={() => selectPart(row)}>
                <strong>{editableRow(row).label}</strong>
                <small>
                  {editableRow(row).category || 'Uncategorised'}
                  {row.draft && ' - draft'}
                </small>
              </button>
            </li>
          ))}
        </ol>
        {sortedParts.length === 0 && <p className="admin-panel-note">No parts yet.</p>}

        <div className="hotspot-create">
          <label>
            New part label
            <input value={newLabel} placeholder="Tilt Cylinder" onChange={(event) => setNewLabel(event.target.value)} />
          </label>
          <button type="button" className="admin-save" onClick={createPart} disabled={!newLabel.trim() || busy}>
            Add part
          </button>
        </div>

        <h2>Inspection Hotspots</h2>
        <p className="admin-panel-note">
          Walk-around checks that are not standalone parts (ignition, horn, hydraulic hoses). They have the same
          detail card but no marker of their own to place.
        </p>
        <ol className="hotspot-list">
          {detailOnly.map((entry) => (
            <li key={entry.id} className={entry.id === selectedId ? 'is-selected' : ''}>
              <button type="button" className="hotspot-list-name" onClick={() => selectDetailOnly(entry)}>
                <strong>{editableRow(entry).title || entry.id}</strong>
                <small>{entry.draft ? 'Detail card - draft' : 'Detail card'}</small>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="hotspot-editor-panel">
        {!detail ? (
          <p className="admin-panel-note">Select a part to reposition or edit it, or add a new one.</p>
        ) : (
          <div className="hotspot-editor">
            <header className="hotspot-editor-bar">
              <div>
                <h2>{part ? part.label : detail.title || detail.id}</h2>
                <p className="hotspot-editor-id">
                  {selectedId}
                  {(stored?.draft || partDetails[selectedId]?.draft) && (
                    <span className="hotspot-badge draft">Unpublished draft</span>
                  )}
                  {dirty && <span className="hotspot-badge dirty">Unsaved changes</span>}
                </p>
              </div>
              <div className="hotspot-editor-actions">
                <button type="button" onClick={saveDraft} disabled={busy}>Save draft</button>
                <button type="button" className="admin-save" onClick={publish} disabled={busy}>Publish</button>
                {(stored?.draft || partDetails[selectedId]?.draft) && (
                  <button type="button" onClick={revert} disabled={busy}>Discard draft</button>
                )}
                {part && (
                  <button type="button" className="hotspot-danger" onClick={remove} disabled={busy}>Delete part</button>
                )}
              </div>
            </header>

            <div className="hotspot-editor-body">
              {part && (
                <section className="hotspot-editor-viewer">
                  <button type="button" className={placing ? 'is-active' : ''} onClick={() => setPlacing((value) => !value)}>
                    {placing ? 'Cancel placement' : 'Place part'}
                  </button>
                  <div className="hotspot-editor-stage">
                    <InteractiveForkliftViewer
                      modelUrl={modelUrl}
                      isAdmin
                      adminEditMode
                      placingActive={placing}
                      hotspots={markers}
                      selectedHotspotId={selectedId}
                      onHotspotSelect={handleMarkerSelect}
                      onPlaceHotspot={(next) => { setPartField({ position: next }); setPlacing(false) }}
                      onDragHotspot={handleMarkerDrag}
                    />
                  </div>
                  <p className="admin-panel-note">
                    Every part is marked on the model. Click a marker to edit that part, drag the selected one to
                    move it, or use Place part to click a new spot. Position:{' '}
                    {position.map((value) => Number(value).toFixed(3)).join(', ')}
                  </p>
                </section>
              )}

              <section className="admin-panel hotspot-editor-fields">
                {part && (
                  <>
                    <label>
                      Part name
                      <input value={part.label || ''} onChange={(event) => setPartField({ label: event.target.value })} />
                    </label>
                    <label>
                      Category
                      <input
                        value={part.category || ''}
                        list="part-category-options"
                        onChange={(event) => setPartField({ category: event.target.value })}
                      />
                    </label>
                    <datalist id="part-category-options">
                      {categories.map((category) => (
                        <option key={category.id} value={category.label} />
                      ))}
                    </datalist>
                    <label>
                      Function
                      <textarea rows={3} value={part.functionText || ''} onChange={(event) => setPartField({ functionText: event.target.value })} />
                    </label>
                    <label>
                      Inspection reminder
                      <textarea rows={2} value={part.inspectionReminder || ''} onChange={(event) => setPartField({ inspectionReminder: event.target.value })} />
                    </label>
                    <label>
                      Safety note
                      <textarea rows={2} value={part.safetyNote || ''} onChange={(event) => setPartField({ safetyNote: event.target.value })} />
                    </label>
                    <label>
                      Related module
                      <input value={part.relatedModule || ''} onChange={(event) => setPartField({ relatedModule: event.target.value })} />
                    </label>
                  </>
                )}

                <h3>Detail card</h3>
                <p className="admin-panel-note">Shown when this marker is clicked, on Parts Identification and in walk-around steps.</p>
                {!part && (
                  <label>
                    Title
                    <input value={detail.title || ''} onChange={(event) => setDetailField({ title: event.target.value })} />
                  </label>
                )}
                <label>
                  Subtitle
                  <input value={detail.subtitle || ''} onChange={(event) => setDetailField({ subtitle: event.target.value })} />
                </label>
                <label>
                  Reference image URL
                  <input value={detail.image || ''} placeholder="/images/forks.png" onChange={(event) => setDetailField({ image: event.target.value })} />
                </label>
                <label>
                  Description (Markdown)
                  <textarea rows={10} value={detail.description || ''} onChange={(event) => setDetailField({ description: event.target.value })} />
                </label>
                <p className="admin-panel-note">
                  Supports markdown: **bold**, - bullet points, 1. numbered lists, and inline images via
                  ![alt](/images/example.png).
                </p>
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default PartHotspotAdmin
