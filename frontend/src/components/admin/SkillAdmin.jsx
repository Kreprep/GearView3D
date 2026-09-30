import { useEffect, useState } from 'react'
import {
  adminCreateSkill,
  adminDeleteSkill,
  adminListCourses,
  adminListSkills,
  adminReorderSkills,
  adminResetSkill,
  adminUpdateSkill,
} from '../../lib/api'
import { useAdminAction } from '../../hooks/useAdminAction'
import { SKILL_CATEGORIES } from '../../lib/skillProgress'
import SkillEvidenceEditor from './SkillEvidenceEditor'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Input, Select, Textarea } from '../ui/input'
import { Panel, PanelHeader, PanelNote } from '../ui/panel'
import { Toolbar } from '../ui/toolbar'

const CATEGORY_LABELS = {
  knowledge: 'Knowledge',
  perceptual: 'Perceptual (awareness and judgement)',
  motor: 'Motor (handling the controls)',
  safety: 'Safety',
  procedural: 'Procedural',
}

const EDITABLE = ['title', 'description', 'category', 'tesdaRef', 'evidence']

function editable(skill) {
  return Object.fromEntries(EDITABLE.map((key) => [key, skill[key]]))
}

// Training Content > Skills: the Skills Checklist catalogue (plan 4.8). Each
// skill's wording, category, TESDA reference and the evidence that shows it.
// Saves immediately, like modules; which modules teach or need a skill is set
// in each module's editor. A skill that has been signed off for anyone keeps
// its trail and cannot be deleted.
function SkillAdmin({ modules, onMessage }) {
  const [skills, setSkills] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [loadState, setLoadState] = useState({ loading: true, error: null })
  const { busy, run } = useAdminAction(onMessage)

  const select = (skill) => {
    setSelectedId(skill?.id || null)
    setDraft(skill ? editable(skill) : null)
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([adminListSkills(), adminListCourses()])
      .then(([skillData, courseData]) => {
        if (cancelled) return
        setSkills(skillData.skills)
        setCourses(courseData.courses)
        setLoadState({ loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setLoadState({ loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selected = skills.find((skill) => skill.id === selectedId) || null
  const replaceSkill = (skill) => setSkills((current) => current.map((entry) => (entry.id === skill.id ? skill : entry)))

  const create = async () => {
    const result = await run(() => adminCreateSkill({ title: newTitle.trim() }), 'Skill added.')
    if (!result) return
    setSkills((current) => [...current, result.skill])
    setNewTitle('')
    select(result.skill)
  }

  const save = async () => {
    const result = await run(() => adminUpdateSkill(selected.id, draft), 'Skill saved.')
    if (result) {
      replaceSkill(result.skill)
      setDraft(editable(result.skill))
    }
  }

  const reset = async () => {
    if (!window.confirm(`Reset "${selected.title}" to its stock wording and evidence?`)) return
    const result = await run(() => adminResetSkill(selected.id), 'Skill reset to default.')
    if (result) {
      replaceSkill(result.skill)
      setDraft(editable(result.skill))
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${selected.title}"? Its module links go with it.`)) return
    const result = await run(() => adminDeleteSkill(selected.id), 'Skill deleted.')
    if (result) {
      setSkills((current) => current.filter((entry) => entry.id !== selected.id))
      select(null)
    }
  }

  const move = async (index, offset) => {
    const ids = skills.map((skill) => skill.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + offset, 0, moved)
    const result = await run(() => adminReorderSkills(ids))
    if (result) setSkills(result.skills)
  }

  const linkedModules = selected
    ? selected.modules.map((link) => ({
        ...link,
        title: modules.find((module) => module.id === link.moduleId)?.title || link.moduleSlug,
      }))
    : []

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader>Skills</PanelHeader>
        <PanelNote>
          The learner&apos;s Skills Checklist, in this order within each category. The stock skills map GearView to the
          TESDA Forklift NC II training regulations; that mapping is a draft for review.
        </PanelNote>
        {loadState.loading && <PanelNote className="mt-2">Loading skills...</PanelNote>}
        {loadState.error && <PanelNote className="mt-2">Skills could not be loaded: {loadState.error}</PanelNote>}

        <ol className="m-0 mt-3 grid list-none gap-1.5 p-0">
          {skills.map((skill, index) => (
            <li
              key={skill.id}
              className={`grid gap-1.5 rounded-lg border px-3 py-2 ${skill.id === selectedId ? 'border-accent bg-accent-soft' : 'border-border'}`}
            >
              <button type="button" className="text-left text-[13.5px] font-bold text-ink" onClick={() => select(skill)}>
                {skill.title}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{CATEGORY_LABELS[skill.category] || skill.category}</Badge>
                {!skill.builtIn && <Badge tone="accent">custom</Badge>}
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="secondary" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                    Up
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy || index === skills.length - 1} onClick={() => move(index, 1)}>
                    Down
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-3 grid gap-2.5 border-t border-slate-200 pt-3">
          <Field label="New skill title">
            <Input value={newTitle} placeholder="Read hand signals" onChange={(event) => setNewTitle(event.target.value)} />
          </Field>
          <Button onClick={create} disabled={busy || !newTitle.trim()}>Add skill</Button>
        </div>
      </Panel>

      {selected && draft ? (
        <Panel>
          <PanelHeader
            actions={
              <>
                {selected.builtIn && <Button variant="secondary" onClick={reset} disabled={busy}>Reset to default</Button>}
                <Button variant="danger" onClick={remove} disabled={busy}>Delete</Button>
                <Button onClick={save} disabled={busy}>Save skill</Button>
              </>
            }
          >
            {selected.title}
          </PanelHeader>
          <div className="grid gap-3.5">
            <div className="grid gap-3.5 md:grid-cols-2">
              <Field label="Title">
                <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </Field>
              <Field label="Category">
                <Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                  {SKILL_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Description" note="One or two plain sentences: what the learner does.">
              <Textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </Field>
            <Field label="TESDA reference" note="The unit and element this skill serves, e.g. CON834218 el. 3.">
              <Input value={draft.tesdaRef} onChange={(event) => setDraft({ ...draft, tesdaRef: event.target.value })} />
            </Field>
            <div className="grid gap-1.5">
              <p className="m-0 text-[13.5px] font-bold text-body">Evidence</p>
              <PanelNote>
                Every item must be met for the skill to show as shown. Progress is reported by the learner&apos;s browser,
                so evidence guides the instructor; the instructor&apos;s sign-off is what confirms a skill.
              </PanelNote>
              <SkillEvidenceEditor
                evidence={draft.evidence}
                onChange={(evidence) => setDraft({ ...draft, evidence })}
                modules={modules}
                courses={courses}
              />
            </div>
            <div className="grid gap-1.5">
              <p className="m-0 text-[13.5px] font-bold text-body">Modules</p>
              {linkedModules.length === 0
                ? <PanelNote>Not linked to a module. Link it in a module&apos;s editor.</PanelNote>
                : (
                  <Toolbar>
                    {linkedModules.map((link) => (
                      <Badge key={link.moduleId} tone={link.relation === 'teaches' ? 'success' : 'neutral'}>
                        {link.relation === 'teaches' ? 'Practised in' : 'Needed for'} {link.title}
                      </Badge>
                    ))}
                  </Toolbar>
                )}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelNote>Select a skill to edit it.</PanelNote>
        </Panel>
      )}
    </div>
  )
}

export default SkillAdmin
