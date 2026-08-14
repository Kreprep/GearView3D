import { useEffect, useState } from 'react'
import InteractiveForkliftViewer from '../InteractiveForkliftViewer'
import {
  adminCreateHotspot,
  adminDeleteHotspot,
  adminListHotspots,
  adminPublishHotspot,
  adminReorderHotspots,
  adminResetHotspot,
  adminRevertHotspot,
  adminSaveHotspotDraft,
} from '../../lib/api'
import { walkAroundDefectOverlays } from '../../data/viewerHotspots'
import './WalkAroundHotspotAdmin.css'

// The one editor for every marker on every equipment's model. A hotspot is one
// physical component, and `inParts` / `inWalkAround` say which surfaces show
// it - so the forklift's mast is edited here once, not once as a part and
// again as an inspection hotspot.
//
// `surface` scopes the list to the page that mounted this ('parts' under Parts
// Identification, 'walk-around' inside a Walk Around step) and decides which
// surfaces a newly created hotspot starts on. The other surface's fields are
// still reachable, because one row can be on both.

const STATE_OPTIONS = [
  ['', 'Every phase'],
  ['engine-off', 'Engine-off'],
  ['engine-on', 'Engine-on'],
  ['ignition', 'Ignition'],
]

const DEFAULT_POSITION = [0, 0.3, 0]

// Everything an admin can edit. Mirrors hotspotDraftFields on the backend, so a
// draft round-trips without losing a field.
function draftOf(hotspot) {
  const source = hotspot.draft ? { ...hotspot, ...hotspot.draft } : hotspot
  return {
    label: source.label || '',
    position: source.position || null,
    inParts: Boolean(source.inParts),
    inWalkAround: Boolean(source.inWalkAround),
    title: source.title || '',
    subtitle: source.subtitle || '',
    image: source.image || '',
    description: source.description || '',
    category: source.category || '',
    functionText: source.functionText || '',
    inspectionReminder: source.inspectionReminder || '',
    safetyNote: source.safetyNote || '',
    relatedModule: source.relatedModule || '',
    checklist: source.checklist || [],
    inspectCategory: source.inspectCategory || '',
    state: source.state || '',
    inspect: source.inspect || '',
    safeFeedback: source.safeFeedback || '',
    unsafeFeedback: source.unsafeFeedback || '',
    unsafeScenarios: source.unsafeScenarios || [],
  }
}

function onSurface(hotspot, surface) {
  if (surface === 'parts') return hotspot.inParts
  if (surface === 'walk-around') return hotspot.inWalkAround
  return true
}

function HotspotAdmin({ equipmentId, modelUrl, categories = [], surface = null, onMessage }) {
  const [hotspots, setHotspots] = useState([])
  const [loadState, setLoadState] = useState({ loading: true, error: null })
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false

    adminListHotspots(equipmentId)
      .then((data) => {
        if (cancelled) return
        setHotspots(data.hotspots)
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [equipmentId])

  const sorted = [...hotspots].sort((a, b) => a.sortOrder - b.sortOrder)
  const visible = showAll || !surface ? sorted : sorted.filter((row) => onSurface(row, surface))
  const hidden = sorted.length - visible.length
  const stored = hotspots.find((row) => row.id === selectedId) || null

  const select = (row) => {
    if (row.id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this hotspot?')) return

    setSelectedId(row.id)
    setDraft(draftOf(row))
    setPlacing(false)
    setDirty(false)
  }

  const setField = (patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const toggleScenario = (scenarioId) => {
    const current = new Set(draft.unsafeScenarios)
    if (current.has(scenarioId)) current.delete(scenarioId)
    else current.add(scenarioId)
    setField({ unsafeScenarios: [...current] })
  }

  const replace = (hotspot) => {
    setHotspots((current) => current.map((entry) => (entry.id === hotspot.id ? hotspot : entry)))
  }

  const run = async (action, message, { resync = false } = {}) => {
    setBusy(true)
    try {
      const result = await action()
      if (result?.hotspot) {
        replace(result.hotspot)
        setDirty(false)
        if (resync) setDraft(draftOf(result.hotspot))
      }
      if (message) onMessage(message)
      return result
    } catch (err) {
      onMessage(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => run(() => adminSaveHotspotDraft(selectedId, draft), 'Draft saved.')

  const publish = async () => {
    const saved = await run(() => adminSaveHotspotDraft(selectedId, draft), null)
    if (!saved) return
    await run(() => adminPublishHotspot(selectedId), 'Published - learners see this now.')
  }

  const revert = () => {
    if (!window.confirm('Discard the unpublished draft and go back to the published version?')) return
    return run(() => adminRevertHotspot(selectedId), 'Draft discarded.', { resync: true })
  }

  const reset = () => {
    if (!window.confirm('Reset this hotspot to its built-in default? Current position and text are replaced.')) return
    return run(() => adminResetHotspot(selectedId), 'Hotspot reset to default.', { resync: true })
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${draft.label}"? Learners will no longer see it on any page.`)) return

    const result = await run(() => adminDeleteHotspot(selectedId), 'Hotspot deleted.')
    if (!result) return
    setHotspots((current) => current.filter((entry) => entry.id !== selectedId))
    setSelectedId(null)
    setDraft(null)
  }

  // A new hotspot starts unpublished, on whichever surface asked for it, with a
  // marker in the middle of the model waiting to be placed.
  const create = async () => {
    if (!newLabel.trim()) return

    const result = await run(
      () => adminCreateHotspot({
        equipmentId,
        label: newLabel.trim(),
        position: DEFAULT_POSITION,
        inParts: surface !== 'walk-around',
        inWalkAround: surface === 'walk-around',
      }),
      'Hotspot created. Place it on the model, then Publish.',
    )
    if (!result) return

    setHotspots((current) => [...current, result.hotspot])
    setSelectedId(result.hotspot.id)
    setDraft(draftOf(result.hotspot))
    setDirty(false)
    setNewLabel('')
  }

  const move = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= sorted.length) return

    const reordered = [...sorted]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    try {
      const result = await adminReorderHotspots(equipmentId, reordered.map((row) => row.id))
      setHotspots(result.hotspots)
    } catch (err) {
      onMessage(err.message)
    }
  }

  if (loadState.loading) return <p className="admin-panel-note">Loading hotspots...</p>
  if (loadState.error) return <p className="admin-panel-note">Hotspots could not be loaded: {loadState.error}</p>

  // Every placed marker is on the model, not just the selected one: placing a
  // spot is a judgement about where it sits relative to its neighbours. The
  // selected one shows its live (possibly unsaved) position; clicking any other
  // switches the editor to it, and dragging moves whichever is selected.
  const markers = sorted
    .map((row) => {
      const source = row.id === selectedId && draft ? draft : (row.draft ? { ...row, ...row.draft } : row)
      return { id: row.id, label: source.label, position: source.position }
    })
    .filter((marker) => Array.isArray(marker.position))

  const handleMarkerSelect = (marker) => {
    const row = hotspots.find((entry) => entry.id === marker.id)
    if (row) select(row)
  }

  const handleMarkerDrag = (id, next) => {
    // Only the selected marker moves; a drag that starts on another one has
    // already selected it through the click above.
    if (id === selectedId) setField({ position: next })
  }

  const summaryOf = (row) => {
    const source = row.draft ? { ...row, ...row.draft } : row
    const surfaces = [source.inParts && 'Parts', source.inWalkAround && 'Walk-around'].filter(Boolean)
    return [
      surfaces.join(' + ') || 'Detail card only',
      row.draft && 'draft',
      !row.published && 'unpublished',
      !row.builtIn && 'custom',
    ].filter(Boolean).join(' - ')
  }

  return (
    <div className="hotspot-admin-body">
      <section className="admin-panel hotspot-list-panel">
        <h2>Hotspots</h2>
        <p className="admin-panel-note">
          Every labelled point on this equipment&apos;s model. One hotspot is one component - tick the surfaces it
          appears on rather than adding it twice.
        </p>

        <ol className="hotspot-list">
          {visible.map((row) => {
            const index = sorted.indexOf(row)
            return (
              <li key={row.id} className={row.id === selectedId ? 'is-selected' : ''}>
                <button type="button" className="hotspot-list-name" onClick={() => select(row)}>
                  <strong>{(row.draft ? { ...row, ...row.draft } : row).label}</strong>
                  <small>{summaryOf(row)}</small>
                </button>
                <span className="hotspot-list-actions">
                  <button type="button" title="Move up" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
                  <button type="button" title="Move down" onClick={() => move(index, 1)} disabled={index === sorted.length - 1}>Down</button>
                </span>
              </li>
            )
          })}
        </ol>

        {visible.length === 0 && <p className="admin-panel-note">No hotspots yet.</p>}

        {hidden > 0 && (
          <button type="button" className="hotspot-show-all" onClick={() => setShowAll(true)}>
            Show {hidden} more not on this page
          </button>
        )}
        {showAll && surface && (
          <button type="button" className="hotspot-show-all" onClick={() => setShowAll(false)}>
            Show only this page&apos;s hotspots
          </button>
        )}

        <div className="hotspot-create">
          <label>
            New hotspot label
            <input value={newLabel} placeholder="Tilt Cylinder" onChange={(event) => setNewLabel(event.target.value)} />
          </label>
          <button type="button" className="admin-save" onClick={create} disabled={!newLabel.trim() || busy}>
            Add hotspot
          </button>
        </div>
      </section>

      <section className="hotspot-editor-panel">
        {!draft ? (
          <p className="admin-panel-note">Select a hotspot to reposition or edit it, or add a new one.</p>
        ) : (
          <div className="hotspot-editor">
            <header className="hotspot-editor-bar">
              <div>
                <h2>{draft.label}</h2>
                <p className="hotspot-editor-id">
                  {selectedId}
                  {stored?.draft && <span className="hotspot-badge draft">Unpublished draft</span>}
                  {!stored?.published && <span className="hotspot-badge unpublished">Not visible to learners</span>}
                  {dirty && <span className="hotspot-badge dirty">Unsaved changes</span>}
                </p>
              </div>
              <div className="hotspot-editor-actions">
                <button type="button" onClick={saveDraft} disabled={busy}>Save draft</button>
                <button type="button" className="admin-save" onClick={publish} disabled={busy}>Publish</button>
                {stored?.draft && <button type="button" onClick={revert} disabled={busy}>Discard draft</button>}
                {stored?.builtIn && <button type="button" onClick={reset} disabled={busy}>Reset to default</button>}
                <button type="button" className="hotspot-danger" onClick={remove} disabled={busy}>Delete hotspot</button>
              </div>
            </header>

            <div className="hotspot-editor-body">
              <section className="hotspot-editor-viewer">
                {draft.position ? (
                  <>
                    <button type="button" className={placing ? 'is-active' : ''} onClick={() => setPlacing((value) => !value)}>
                      {placing ? 'Cancel placement' : 'Place hotspot'}
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
                        onPlaceHotspot={(next) => { setField({ position: next }); setPlacing(false) }}
                        onDragHotspot={handleMarkerDrag}
                      />
                    </div>
                    <p className="admin-panel-note">
                      Every placed hotspot is marked on the model. Click a marker to edit it, drag the selected one to
                      move it, or use Place hotspot to click a new spot. Position:{' '}
                      {draft.position.map((value) => Number(value).toFixed(3)).join(', ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="admin-panel-note">
                      This is a detail card with no marker of its own - a check that describes something the model has
                      no separate point for. Give it a position to put it on the model.
                    </p>
                    <button type="button" onClick={() => setField({ position: DEFAULT_POSITION })}>
                      Add a marker
                    </button>
                  </>
                )}
              </section>

              <section className="admin-panel hotspot-editor-fields">
                <label>
                  Label
                  <input value={draft.label} onChange={(event) => setField({ label: event.target.value })} />
                </label>

                <fieldset className="hotspot-scenario-fieldset">
                  <legend>Shown on</legend>
                  <label className="hotspot-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.inParts}
                      onChange={(event) => setField({ inParts: event.target.checked })}
                    />
                    Parts Identification
                  </label>
                  <label className="hotspot-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.inWalkAround}
                      onChange={(event) => setField({ inWalkAround: event.target.checked })}
                    />
                    Walk-around inspection
                  </label>
                </fieldset>

                <h3>Detail card</h3>
                <p className="admin-panel-note">Shown when this marker is clicked, on every surface it appears on.</p>
                <label>
                  Title
                  <input value={draft.title} placeholder={draft.label} onChange={(event) => setField({ title: event.target.value })} />
                </label>
                <label>
                  Subtitle
                  <input value={draft.subtitle} onChange={(event) => setField({ subtitle: event.target.value })} />
                </label>
                <label>
                  Reference image URL
                  <input value={draft.image} placeholder="/images/forks.png" onChange={(event) => setField({ image: event.target.value })} />
                </label>
                <label>
                  Description (Markdown)
                  <textarea rows={10} value={draft.description} onChange={(event) => setField({ description: event.target.value })} />
                </label>
                <p className="admin-panel-note">
                  Supports markdown: **bold**, - bullet points, 1. numbered lists, and inline images via
                  ![alt](/images/example.png).
                </p>

                {draft.inParts && (
                  <>
                    <h3>Parts Identification</h3>
                    <label>
                      Category
                      <input
                        value={draft.category}
                        list="hotspot-category-options"
                        onChange={(event) => setField({ category: event.target.value })}
                      />
                    </label>
                    <datalist id="hotspot-category-options">
                      {categories.map((category) => (
                        <option key={category.id} value={category.label} />
                      ))}
                    </datalist>
                    <label>
                      Function
                      <textarea rows={3} value={draft.functionText} onChange={(event) => setField({ functionText: event.target.value })} />
                    </label>
                    <label>
                      Inspection reminder
                      <textarea rows={2} value={draft.inspectionReminder} onChange={(event) => setField({ inspectionReminder: event.target.value })} />
                    </label>
                    <label>
                      Safety note
                      <textarea rows={2} value={draft.safetyNote} onChange={(event) => setField({ safetyNote: event.target.value })} />
                    </label>
                    <label>
                      Related module
                      <input value={draft.relatedModule} onChange={(event) => setField({ relatedModule: event.target.value })} />
                    </label>
                  </>
                )}

                {draft.inWalkAround && (
                  <>
                    <h3>Walk-around inspection</h3>
                    <label>
                      Inspection grouping
                      <input value={draft.inspectCategory} onChange={(event) => setField({ inspectCategory: event.target.value })} />
                      <small className="admin-field-note">
                        Separate from the parts category above, because the same component is grouped differently when
                        it is being inspected.
                      </small>
                    </label>
                    <label>
                      Engine phase
                      <select value={draft.state} onChange={(event) => setField({ state: event.target.value })}>
                        {STATE_OPTIONS.map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                      <small className="admin-field-note">
                        Which walk-around phase shows this marker. Every phase is right for equipment that does not
                        model engine states.
                      </small>
                    </label>
                    <label>
                      Inspect instructions
                      <textarea rows={3} value={draft.inspect} onChange={(event) => setField({ inspect: event.target.value })} />
                    </label>
                    <label>
                      Safe feedback
                      <textarea rows={2} value={draft.safeFeedback} onChange={(event) => setField({ safeFeedback: event.target.value })} />
                    </label>
                    <label>
                      Unsafe feedback
                      <textarea rows={2} value={draft.unsafeFeedback} onChange={(event) => setField({ unsafeFeedback: event.target.value })} />
                    </label>
                    <fieldset className="hotspot-scenario-fieldset">
                      <legend>Defect scenarios that make this hotspot unsafe</legend>
                      {walkAroundDefectOverlays.map((overlay) => (
                        <label key={overlay.id} className="hotspot-checkbox">
                          <input
                            type="checkbox"
                            checked={draft.unsafeScenarios.includes(overlay.scenario)}
                            onChange={() => toggleScenario(overlay.scenario)}
                          />
                          {overlay.label}
                        </label>
                      ))}
                    </fieldset>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default HotspotAdmin
