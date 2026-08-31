import { CircleCheck, CircleDashed, CircleDot } from 'lucide-react'
import { useT } from '../../i18n'

// Draft / unpublished / custom status pills - the step list used to append
// these as plain text (" - draft", " - unpublished", " - custom") - plus the
// learner pages' status chips (READY / DONE / IN PROGRESS / NOT STARTED),
// which were .status-pill* in four stylesheets. One of those, .status-pill-soon,
// was applied at ModulesPage.jsx:106 but had no rule anywhere, so "Coming Soon"
// rendered as an accidental unstyled grey; `todo` below is that tone made
// deliberate.
const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-600',
  accent: 'bg-accent-soft text-accent-strong',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
  // Status, in the safety-decal vocabulary: green is a safe/complete
  // condition, blue is the action to take, grey is not started.
  done: 'bg-emerald-50 text-status-done',
  progress: 'bg-accent-soft text-status-progress',
  todo: 'bg-slate-100 text-slate-500',
  onDeep: 'bg-white/10 text-surface-deep-accent',
}

// `shrink-0 whitespace-nowrap` is not decoration: these sit in a flex row
// opposite a heading that can be long, and without it the chip is the thing
// that collapses and wraps mid-word.
export function Badge({ children, tone = 'neutral', icon: Icon, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone] || TONE_CLASSES.neutral} ${className}`.trim()}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}

// Percentage -> status chip. The module list and the hub's numbered path both
// need exactly this mapping, and a learner reads the chip before the number, so
// the two surfaces must never disagree about what "done" looks like.
export function StatusBadge({ percent, className = '' }) {
  const t = useT()
  const value = Number(percent) || 0

  if (value >= 100) return <Badge tone="done" icon={CircleCheck} className={className}>{t('common.status.done')}</Badge>
  if (value > 0) return <Badge tone="progress" icon={CircleDot} className={className}>{t('common.status.inProgress')}</Badge>
  return <Badge tone="todo" icon={CircleDashed} className={className}>{t('common.status.notStarted')}</Badge>
}
