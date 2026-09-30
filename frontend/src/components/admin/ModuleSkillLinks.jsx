import { useEffect, useState } from 'react'
import { adminListSkills, adminSetModuleSkills } from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { Button } from '../ui/button'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Select } from '../ui/input'

const RELATION_OPTIONS = [
  ['', 'Not linked'],
  ['teaches', "Practised here (Skills you'll practise)"],
  ['requires', 'Needed first (Skills you need)'],
]

function linksOf(skills, moduleId) {
  return Object.fromEntries(
    skills.flatMap((skill) =>
      skill.modules.filter((link) => link.moduleId === moduleId).map((link) => [skill.id, link.relation]),
    ),
  )
}

// Which skills this module teaches and which it expects the learner to bring,
// one choice per skill in the catalogue (Training Content > Skills). Saved as
// a whole set: the module's links are replaced by what is chosen here.
function ModuleSkillLinks({ module, onMessage }) {
  const [skills, setSkills] = useState([])
  const [relations, setRelations] = useState({})
  const [loadState, setLoadState] = useState({ loading: true, error: null })
  const { busy, run } = useAdminAction(onMessage)

  useEffect(() => {
    let cancelled = false

    adminListSkills()
      .then((data) => {
        if (cancelled) return
        setSkills(data.skills)
        setRelations(linksOf(data.skills, module.id))
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [module.id])

  const save = async () => {
    const links = Object.entries(relations)
      .filter(([, relation]) => relation)
      .map(([skillId, relation]) => ({ skillId, relation }))
    const result = await run(() => adminSetModuleSkills(module.id, links), 'Skill links saved.')
    if (result) {
      setSkills(result.skills)
      setRelations(linksOf(result.skills, module.id))
    }
  }

  return (
    <Panel>
      <PanelHeader actions={<Button onClick={save} disabled={busy || loadState.loading}>Save skill links</Button>}>
        Skills
      </PanelHeader>
      <PanelNote>
        Shown to learners on this module&apos;s briefing and sidebar, and as chips on its card in the module list.
        The skills themselves are edited under Training Content &gt; Skills.
      </PanelNote>
      {loadState.loading && <PanelNote className="mt-2">Loading skills...</PanelNote>}
      {loadState.error && <PanelNote className="mt-2">Skills could not be loaded: {loadState.error}</PanelNote>}
      {!loadState.loading && !loadState.error && skills.length === 0 && (
        <PanelNote className="mt-2">There are no skills in the catalogue yet.</PanelNote>
      )}
      <div className="mt-3 grid gap-2">
        {skills.map((skill) => (
          <label key={skill.id} className="grid items-center gap-2 text-[13.5px] font-semibold text-body md:grid-cols-[1fr_minmax(220px,300px)]">
            <span>{skill.title}</span>
            <Select
              value={relations[skill.id] || ''}
              onChange={(event) => setRelations({ ...relations, [skill.id]: event.target.value })}
            >
              {RELATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
        ))}
      </div>
    </Panel>
  )
}

export default ModuleSkillLinks
