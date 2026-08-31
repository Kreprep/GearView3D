const VARIANT_CLASSES = {
  default: 'border-transparent bg-accent text-white hover:bg-accent-strong',
  secondary: 'border-border bg-panel text-ink hover:bg-accent-soft',
  danger: 'border-transparent bg-red-600 text-white hover:bg-red-500',
  ghost: 'border-transparent bg-transparent text-body hover:bg-accent-soft',
  // The dark CTA four stylesheets defined separately (.continue-button,
  // .survey-link-button, the hub's assessment button, AssessmentPage's).
  deep: 'border-transparent bg-surface-deep text-white hover:bg-slate-800',
  // The same action sitting ON the plate, where a dark fill would vanish.
  onDeep: 'border-transparent bg-surface-deep-accent text-surface-deep hover:bg-cyan-200',
}

const SIZE_CLASSES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

// `as` lets the survey link render as a real <a> - it navigates off-site, so a
// <button> with an onClick would be the wrong element however it looks.
//
// `stretched` makes this the single activator for the card around it: the
// pseudo-element covers the card's whole box, so the card needs no role, no
// tabIndex and no keydown handler, and there is one tab stop instead of two.
// The card must be `relative isolate` - Card's `stretchedAction` prop does
// exactly that.
export function Button({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  as: Tag = 'button',
  stretched = false,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-1.5 rounded-xl border font-medium transition focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60'
  const variantClasses = VARIANT_CLASSES[variant] || variant
  const sizeClasses = SIZE_CLASSES[size] || size
  const stretchedClasses = stretched ? 'after:absolute after:inset-0 after:content-[""]' : ''

  return (
    <Tag
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${stretchedClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  )
}
