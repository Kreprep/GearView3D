import { useEffect, useMemo, useState } from 'react'
import { getChecklist } from '../lib/api'
import { useProgress } from '../hooks/useProgress'
import './GuidedChecklist.css'

function GuidedChecklist({ moduleSlug, title }) {
  const [items, setItems] = useState([])
  const [checked, setChecked] = useState({})
  const [saved, setSaved] = useState(false)
  const { progress, updateChecklist } = useProgress()

  useEffect(() => {
    getChecklist(moduleSlug).then((checklist) => {
      setItems(checklist)
      const completedItems = progress.checklists[moduleSlug]?.completedItems || []
      setChecked(Object.fromEntries(completedItems.map((item) => [item, true])))
      setSaved(false)
    })
  }, [moduleSlug, progress.checklists])

  const completedCount = useMemo(
    () => items.filter((item) => checked[item]).length,
    [checked, items],
  )
  const completionPercentage = items.length ? Math.round((completedCount / items.length) * 100) : 0

  const toggleItem = (item) => {
    setChecked((current) => {
      const next = {
        ...current,
        [item]: !current[item],
      }
      const completedItems = Object.keys(next).filter((key) => next[key])
      updateChecklist(moduleSlug, completedItems)
      setSaved(true)
      return next
    })
  }

  const handleSave = async () => {
    updateChecklist(moduleSlug, Object.keys(checked).filter((item) => checked[item]))
    setSaved(true)
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

      <div className="checklist-items">
        {items.map((item, index) => (
          <label key={item} className={`checklist-item ${checked[item] ? 'is-complete' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(checked[item])}
              onChange={() => toggleItem(item)}
            />
            <span className="checklist-number">{index + 1}</span>
            <span>{item}</span>
          </label>
        ))}
      </div>

      <button className="checklist-save" onClick={handleSave}>
        {saved ? 'Progress saved' : 'Save progress'}
      </button>
    </section>
  )
}

export default GuidedChecklist
