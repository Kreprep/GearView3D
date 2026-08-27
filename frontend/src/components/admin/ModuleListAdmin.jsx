import { useState } from 'react'
import { adminCreateModule, adminDeleteModule, adminReorderModules } from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'

// The ordered module list for one equipment: open, reorder, delete, add.
// Opening a module hands off to ModuleEditor, which is where its steps,
// checklist items and quiz questions are edited.
function ModuleListAdmin({ equipmentId, modules, onModulesChanged, onOpenModule, onMessage }) {
  const [newTitle, setNewTitle] = useState('')
  const { run } = useAdminAction(onMessage)

  const ordered = [...modules].sort((a, b) => a.sortOrder - b.sortOrder)

  const move = async (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= ordered.length) return

    const reordered = [...ordered]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(target, 0, entry)

    const result = await run(
      () => adminReorderModules(equipmentId, reordered.map((module) => module.id)),
      null,
    )
    if (result) onModulesChanged(result.modules)
  }

  const addModule = async () => {
    if (!newTitle.trim()) return
    const result = await run(
      () => adminCreateModule({ equipmentId, title: newTitle.trim() }),
      'Module created with a blank Read Up step.',
    )
    if (!result) return
    onModulesChanged([...modules, result.module])
    setNewTitle('')
    onOpenModule(result.module)
  }

  const remove = async (module) => {
    if (!window.confirm(`Delete "${module.title}"? Its steps, checklist items and quiz questions go with it.`)) return
    const result = await run(() => adminDeleteModule(module.id), 'Module deleted.')
    if (!result) return
    onModulesChanged(modules.filter((entry) => entry.id !== module.id))
  }

  return (
    <>
      <section className="admin-panel wide-panel">
        <h2>Training Modules</h2>
        <p className="admin-panel-note">
          The cards learners see on this equipment&apos;s module list, in this order. Open one to edit its steps,
          checklist items and quiz questions.
        </p>

        {ordered.map((module, index) => (
          <article key={module.id} className="admin-list-item">
            <h3>{index + 1}. {module.title}</h3>
            <p>{module.subtitle ? `${module.subtitle} - ` : ''}{module.description}</p>
            <div className="admin-row-actions">
              <button className="admin-save" onClick={() => onOpenModule(module)}>Edit</button>
              <button onClick={() => move(index, -1)} disabled={index === 0}>Move up</button>
              <button onClick={() => move(index, 1)} disabled={index === ordered.length - 1}>Move down</button>
              <button onClick={() => remove(module)}>Delete</button>
            </div>
          </article>
        ))}
        {ordered.length === 0 && <p className="admin-panel-note">No modules for this equipment yet.</p>}
      </section>

      <section className="admin-panel admin-editor">
        <h2>Add Module</h2>
        <p className="admin-panel-note">
          A new module starts with one blank Read Up step so it has something to show; add driving, checklist and
          quiz steps inside it.
        </p>
        <label>
          Module title
          <input value={newTitle} placeholder="Load Handling" onChange={(event) => setNewTitle(event.target.value)} />
        </label>
        <button className="admin-save" onClick={addModule} disabled={!newTitle.trim()}>Add module</button>
      </section>
    </>
  )
}

export default ModuleListAdmin
