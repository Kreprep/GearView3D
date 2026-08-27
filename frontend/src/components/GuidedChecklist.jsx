import { useEffect, useMemo, useState } from 'react'
import { getChecklist } from '../lib/api'
import { useProgress } from '../hooks/useProgress'
import { getStoredProgress } from '../lib/progressService'
import './GuidedChecklist.css'

function GuidedChecklist({ moduleSlug, title }) {
  const [items, setItems] = useState([])
  const [checked, setChecked] = useState({})
  const [error, setError] = useState(null)
  const { updateChecklist } = useProgress()

  useEffect(() => {
    let cancelled = false

    getChecklist(moduleSlug)
      .then((checklist) => {
        if (cancelled) return
        setItems(checklist)
        setError(null)
        // Read the stored snapshot directly rather than closing over the
        // reactive `progress` value - toggleItem below writes progress via
        // updateChecklist, and depending this effect on that value would
        // refetch the checklist over HTTP on every click.
        const completedItems = getStoredProgress().checklists[moduleSlug]?.completedItems || []
        setChecked(Object.fromEntries(completedItems.map((id) => [id, true])))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  const completedCount = useMemo(
    () => items.filter((item) => checked[item.id]).length,
    [checked, items],
  )
  const completionPercentage = items.length ? Math.round((completedCount / items.length) * 100) : 0

  const toggleItem = (itemId) => {
    setChecked((current) => {
      const next = {
        ...current,
        [itemId]: !current[itemId],
      }
      const completedItems = Object.keys(next).filter((key) => next[key])
      updateChecklist(moduleSlug, completedItems)
      return next
    })
  }

  return (
    <section className="guided-checklist">
      <div className="checklist-header">
        <div>
          <p className="checklist-kicker">Guided activity</p>
          <h3>{title}</h3>
        </div>
        <span className="checklist-progress">{completionPercentage}% complete</span>
      </div>

      <div className="checklist-bar">
        <div style={{ width: `${completionPercentage}%` }} />
      </div>

      {error && <p className="checklist-error">Checklist could not be loaded: {error}</p>}

      <div className="checklist-items">
        {items.map((item, index) => (
          <label key={item.id} className={`checklist-item ${checked[item.id] ? 'is-complete' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(checked[item.id])}
              onChange={() => toggleItem(item.id)}
            />
            <span className="checklist-number">{index + 1}</span>
            <span>{item.text}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

export default GuidedChecklist
