import { BadgeCheck, CircleCheck, CircleDashed, CircleDot } from 'lucide-react'
import { SKILL_STATUS_KEYS } from '../lib/skillText'
import { Badge } from './ui/badge'

// A skill's status (lib/skillProgress.js) as a chip. Signed off is the
// instructor's stamp; shown is the evidence complete without one.
const APPEARANCE = {
  'not-started': { tone: 'todo', icon: CircleDashed },
  'in-progress': { tone: 'progress', icon: CircleDot },
  demonstrated: { tone: 'success', icon: CircleCheck },
  'signed-off': { tone: 'done', icon: BadgeCheck },
}

// `t` is the caller's: the learner pages pass useT()'s, the dashboard an
// English one.
export function SkillStatusBadge({ status, t, className = '' }) {
  const { tone, icon } = APPEARANCE[status] || APPEARANCE['not-started']
  return (
    <Badge tone={tone} icon={icon} className={className}>
      {t(SKILL_STATUS_KEYS[status] || SKILL_STATUS_KEYS['not-started'])}
    </Badge>
  )
}
