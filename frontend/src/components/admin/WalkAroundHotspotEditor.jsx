import { useState } from 'react'
import InteractiveForkliftViewer from '../InteractiveForkliftViewer'
import {
  adminDeleteWalkAroundHotspot,
  adminPublishWalkAroundHotspot,
  adminResetWalkAroundHotspot,
  adminRevertWalkAroundHotspot,
  adminSaveWalkAroundHotspotDraft,
} from '../../lib/api'
import { walkAroundDefectOverlays } from '../../data/viewerHotspots'
import './WalkAroundHotspotAdmin.css'

const STATE_OPTIONS = [
  ['engine-off', 'Engine-off'],
  ['engine-on', 'Engine-on'],
  ['ignition', 'Ignition'],
]

function draftOf(hotspot) {
  const source = hotspot.draft || hotspot
  return {
    label: source.label,
    position: source.position || [0, 0.3, 0],
    state: source.state || 'engine-off',
    category: source.category || '',
    inspect: source.inspect || '',
    safeFeedback: source.safeFeedback || '',
    unsafeFeedback: source.unsafeFeedback || '',
    unsafeScenarios: source.unsafeScenarios || [],
  }
}

function WalkAroundHotspotEditor({ hotspot, onHotspotChanged, onHotspotDeleted, onMessage }) {
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

  const toggleScenario = (scenarioId) => {
    const current = new Set(draft.unsafeScenarios)
    if (current.has(scenarioId)) current.delete(scenarioId)
    else current.add(scenarioId)
    setField({ unsafeScenarios: [...current] })
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

  const saveDraft = () => run(() => adminSaveWalkAroundHotspotDraft(hotspot.id, draft), 'Draft saved.')

  const publish = async () => {
    const saved = await run(() => adminSaveWalkAroundHotspotDraft(hotspot.id, draft), 'Draft saved.')
    if (!saved) return
    await run(() => adminPublishWalkAroundHotspot(hotspot.id), 'Hotspot published - learners see it now.')
  }

  const revert = () => {
    if (!window.confirm('Discard the unpublished draft and go back to the published version?')) return
    return run(() => adminRevertWalkAroundHotspot(hotspot.id), 'Draft discarded.', { resync: true })
  }

  const reset = () => {
    if (!window.confirm('Reset this hotspot to its built-in default? Current position and text are replaced.')) return
    return run(() => adminResetWalkAroundHotspot(hotspot.id), 'Hotspot reset to default.', { resync: true })
  }

  const remove = async () => {
    if (!window.confirm(`Delete the hotspot "${draft.label}"? Learners will no longer see it.`)) return
    setBusy(true)
    try {
      await adminDeleteWalkAroundHotspot(hotspot.id)
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
          {hotspot.builtIn && <button type="button" onClick={reset} disabled={busy}>Reset to default</button>}
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
            State
            <select value={draft.state} onChange={(event) => setField({ state: event.target.value })}>
              {STATE_OPTIONS.map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input value={draft.category} onChange={(event) => setField({ category: event.target.value })} />
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
        </section>
      </div>
    </div>
  )
}

export default WalkAroundHotspotEditor
