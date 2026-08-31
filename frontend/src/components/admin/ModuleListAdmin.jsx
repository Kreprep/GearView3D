import { useState } from 'react'
import { adminCreateModule, adminDeleteModule, adminReorderModules } from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input } from '../ui/input'
import { Toolbar } from '../ui/toolbar'

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
      <Panel>
        <PanelHeader>Training Modules</PanelHeader>
        <PanelNote>
          The cards learners see on this equipment&apos;s module list, in this order. Open one to edit its steps,
          checklist items and quiz questions.
        </PanelNote>

        <div className="mt-2 grid">
          {ordered.map((module, index) => (
            <article key={module.id} className="border-t border-slate-200 py-3 first:border-t-0">
              <h3 className="m-0 text-sm font-extrabold text-ink">{index + 1}. {module.title}</h3>
              <p className="mt-1 text-[13px] text-muted">{module.subtitle ? `${module.subtitle} - ` : ''}{module.description}</p>
              <Toolbar>
                <Button size="sm" onClick={() => onOpenModule(module)}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => move(index, -1)} disabled={index === 0}>Move up</Button>
                <Button size="sm" variant="secondary" onClick={() => move(index, 1)} disabled={index === ordered.length - 1}>Move down</Button>
                <Button size="sm" variant="danger" onClick={() => remove(module)}>Delete</Button>
              </Toolbar>
            </article>
          ))}
        </div>
        {ordered.length === 0 && <PanelNote className="mt-2">No modules for this equipment yet.</PanelNote>}
      </Panel>

      <Panel>
        <PanelHeader>Add Module</PanelHeader>
        <PanelNote>
          A new module starts with one blank Read Up step so it has something to show; add driving, checklist and
          quiz steps inside it.
        </PanelNote>
        <Field label="Module title" className="mt-3">
          <Input value={newTitle} placeholder="Load Handling" onChange={(event) => setNewTitle(event.target.value)} />
        </Field>
        <Toolbar>
          <Button onClick={addModule} disabled={!newTitle.trim()}>Add module</Button>
        </Toolbar>
      </Panel>
    </>
  )
}

export default ModuleListAdmin
