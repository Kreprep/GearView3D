import { useEffect, useMemo, useState } from 'react'
import { getChecklist, saveProgress } from '../lib/api'
import './GuidedChecklist.css'

function GuidedChecklist({ moduleSlug, title }) {
  const [items, setItems] = useState([])
  const [checked, setChecked] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getChecklist(moduleSlug).then((checklist) => {
      setItems(checklist)
      setChecked({})
      setSaved(false)
    })
  }, [moduleSlug])

  const completedCount = useMemo(
    () => items.filter((item) => checked[item]).length,
    [checked, items],
  )
  const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0

  const toggleItem = (item) => {
    setSaved(false)
    setChecked((current) => ({
      ...current,
      [item]: !current[item],
    }))
  }

  const handleSave = async () => {
    await saveProgress({
      moduleSlug,
      completedSteps: Object.keys(checked).filter((item) => checked[item]),
      progress,
    })
    setSaved(true)
  }

  return (
    <section className="guided-checklist">
      <div className="checklist-header">
        <div>
          <p className="checklist-kicker">Guided activity</p>
          <h3>{title}</h3>
        </div>
        <span className="checklist-progress">{progress}% complete</span>
      </div>

      <div className="checklist-bar">
        <div style={{ width: `${progress}%` }} />
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
