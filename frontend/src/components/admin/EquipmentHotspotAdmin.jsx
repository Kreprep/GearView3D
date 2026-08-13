import { useEffect, useState } from 'react'
import { adminCreateEquipmentHotspot, adminListEquipmentHotspots, adminReorderEquipmentHotspots } from '../../lib/api'
import EquipmentHotspotEditor from './EquipmentHotspotEditor'
import './WalkAroundHotspotAdmin.css'

// The equivalent of WalkAroundHotspotAdmin for any equipment other than
// Forklift - same list + editor split, but reading/writing EquipmentHotspot
// rows scoped to `equipmentId` instead of the single implicit Forklift table.
function EquipmentHotspotAdmin({ equipmentId, modelUrl, onMessage }) {
  const [hotspots, setHotspots] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [loadState, setLoadState] = useState({ loading: true, error: null })

  // Remounted by the parent (key={equipmentId}) whenever the active equipment
  // section changes, so this effect only ever runs once per equipment - no
  // need to reset loadState/selectedId here, their initial values already do.
  useEffect(() => {
    let cancelled = false

    adminListEquipmentHotspots(equipmentId)
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
  const selected = hotspots.find((hotspot) => hotspot.id === selectedId) || null

  const replaceHotspot = (hotspot) => {
    setHotspots((current) => current.map((entry) => (entry.id === hotspot.id ? hotspot : entry)))
  }

  const handleDeleted = (hotspotId) => {
    setHotspots((current) => current.filter((entry) => entry.id !== hotspotId))
    setSelectedId(null)
  }

  const createHotspot = async () => {
    if (!newLabel.trim()) return
    try {
      const result = await adminCreateEquipmentHotspot({ equipmentId, label: newLabel.trim() })
      setHotspots((current) => [...current, result.hotspot])
      setSelectedId(result.hotspot.id)
      setNewLabel('')
      onMessage('Hotspot created. Place it on the model, then Publish to show it to learners.')
    } catch (err) {
      onMessage(err.message)
    }
  }

  const moveHotspot = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= sorted.length) return

    const reordered = [...sorted]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    try {
      const result = await adminReorderEquipmentHotspots(equipmentId, reordered.map((hotspot) => hotspot.id))
      setHotspots(result.hotspots)
    } catch (err) {
      onMessage(err.message)
    }
  }

  if (loadState.loading) return <p className="admin-panel-note">Loading hotspots...</p>
  if (loadState.error) return <p className="admin-panel-note">Hotspots could not be loaded: {loadState.error}</p>

  return (
    <div className="hotspot-admin-body">
      <section className="admin-panel hotspot-list-panel">
        <h2>Hotspots</h2>
        <p className="admin-panel-note">
          Every 3D hotspot on this equipment's model, in the order learners encounter them on the Hotspot
          Identification page.
        </p>

        <ol className="hotspot-list">
          {sorted.map((hotspot, index) => (
            <li key={hotspot.id} className={hotspot.id === selectedId ? 'is-selected' : ''}>
              <button type="button" className="hotspot-list-name" onClick={() => setSelectedId(hotspot.id)}>
                <strong>{hotspot.label}</strong>
                <small>
                  {hotspot.draft && ' Draft'}
                  {!hotspot.published && ' - unpublished'}
                </small>
              </button>
              <span className="hotspot-list-actions">
                <button type="button" onClick={() => moveHotspot(index, -1)} disabled={index === 0}>Up</button>
                <button type="button" onClick={() => moveHotspot(index, 1)} disabled={index === sorted.length - 1}>Down</button>
              </span>
            </li>
          ))}
        </ol>

        {sorted.length === 0 && <p>No hotspots yet.</p>}

        <div className="hotspot-create">
          <label>
            New hotspot label
            <input
              value={newLabel}
              placeholder="Bucket"
              onChange={(event) => setNewLabel(event.target.value)}
            />
          </label>
          <button type="button" className="admin-save" onClick={createHotspot} disabled={!newLabel.trim()}>
            Add hotspot
          </button>
        </div>
      </section>

      <section className="hotspot-editor-panel">
        {selected ? (
          <EquipmentHotspotEditor
            key={selected.id}
            hotspot={selected}
            modelUrl={modelUrl}
            onHotspotChanged={replaceHotspot}
            onHotspotDeleted={handleDeleted}
            onMessage={onMessage}
          />
        ) : (
          <p className="admin-panel-note">Select a hotspot to reposition or edit it, or add a new one.</p>
        )}
      </section>
    </div>
  )
}

export default EquipmentHotspotAdmin
