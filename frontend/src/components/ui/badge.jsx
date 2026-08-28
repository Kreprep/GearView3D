// Draft / unpublished / custom status pills - the step list used to append
// these as plain text (" - draft", " - unpublished", " - custom").
const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-600',
  accent: 'bg-accent-soft text-accent-strong',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[tone] || TONE_CLASSES.neutral} ${className}`.trim()}
    >
      {children}
    </span>
  )
}
