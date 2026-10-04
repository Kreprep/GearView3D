import { useT } from '../i18n'
import { SkillStatusBadge } from './SkillStatusBadge'

// "Skills you'll practise" and "Skills you need" for one module
// (hooks/useModuleSkills.js), on the briefing's task panel, with the
// learner's status beside each skill. Renders nothing for a module with no
// linked skills.
export function ModuleSkills({ practise, need }) {
  const t = useT()
  const groups = [
    { key: 'practise', label: t('skills.module.practise'), entries: practise },
    { key: 'need', label: t('skills.module.need'), entries: need },
  ].filter((group) => group.entries.length)

  if (!groups.length) return null

  return groups.map((group) => (
    <div key={group.key} className="module-skills">
      <p className="simulation-section-label">{group.label}</p>
      <ul className="module-skills-list">
        {group.entries.map(({ skill, status }) => (
          <li key={skill.id}>
            <span>{skill.title}</span>
            <SkillStatusBadge status={status} t={t} />
          </li>
        ))}
      </ul>
    </div>
  ))
}
