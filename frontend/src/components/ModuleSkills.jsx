import { useT } from '../i18n'
import { SkillStatusBadge } from './SkillStatusBadge'

// "Skills you'll practise" and "Skills you need" for one module
// (hooks/useModuleSkills.js). Two sizes of the same lists: `compact` is the
// shell's sidebar, on every step, titles only; the full one is the briefing's
// task panel, with the learner's status beside each skill. Renders nothing for
// a module with no linked skills.
export function ModuleSkills({ practise, need, compact = false }) {
  const t = useT()
  const groups = [
    { key: 'practise', label: t('skills.module.practise'), entries: practise },
    { key: 'need', label: t('skills.module.need'), entries: need },
  ].filter((group) => group.entries.length)

  if (!groups.length) return null

  return groups.map((group) => (
    <div key={group.key} className={compact ? 'module-skills is-compact' : 'module-skills'}>
      <p className="simulation-panel-label">{group.label}</p>
      <ul className={compact ? 'simulation-objectives' : 'module-skills-list'}>
        {group.entries.map(({ skill, status }) => (
          <li key={skill.id}>
            <span>{skill.title}</span>
            {!compact && <SkillStatusBadge status={status} t={t} />}
          </li>
        ))}
      </ul>
    </div>
  ))
}
