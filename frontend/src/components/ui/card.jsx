// The learner pages' card surface: the module list's module cards, the hub's numbered path rows, and the dark operator
// plate the hub hero and the login band are built from.
const TONE_CLASSES = {
  light: 'border-border bg-panel text-body',
  // The stamped plate. One per page - everything below it stays flat white.
  deep: 'border-white/10 bg-surface-deep text-white/80',
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

// `layout` owns the display property, so a caller never passes a competing
// `grid`/`flex` utility through className. Two display utilities on one element
// resolve by stylesheet order rather than by the order they are written, which
// makes that override silently unpredictable.
//
// `grid` exists for rows that must align a column across sibling cards - the
// hub's numbered path aligns its action buttons with `grid-cols-subgrid`, so the
// action column is as wide as the widest label in whatever language, with
// whatever text an admin typed.
const LAYOUT_CLASSES = {
  stack: 'flex flex-col',
  grid: 'grid',
}

// `stretchedAction` is the reason this exists rather than an onActivate prop.
// The cards it replaces hand-rolled role="button" + tabIndex + onKeyDown on an
// element that *contains* a real <button>: nested interactive content inside a
// widget role, two tab stops for one destination, and an inner button that only
// worked because it called stopPropagation. Instead the card is a plain
// <article> with no role and no tabIndex, and the Button inside it carries
// `stretched` (after:absolute after:inset-0) so its hit area covers the card.
// One tab stop, one accessible name, clicking anywhere still works.
export function Card({
  as: Tag = 'article',
  tone = 'light',
  padding = 'md',
  layout = 'stack',
  interactive = false,
  stretchedAction = false,
  className = '',
  children,
  ...props
}) {
  return (
    <Tag
      className={[
        'min-w-0 overflow-hidden rounded-2xl border',
        LAYOUT_CLASSES[layout] || LAYOUT_CLASSES.stack,
        TONE_CLASSES[tone] || TONE_CLASSES.light,
        PADDING_CLASSES[padding] ?? PADDING_CLASSES.md,
        // `isolate` keeps the stretched pseudo-element inside this card's own
        // stacking context, so two adjacent cards cannot overlap hit areas.
        stretchedAction ? 'relative isolate' : '',
        interactive ? 'transition hover:-translate-y-0.5 hover:shadow-md' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Tag>
  )
}

// The photo band on a module card. The scrim is what keeps overlaid text
// legible against an arbitrary admin-supplied photo, so it is not optional
// styling.
export function CardMedia({ src, height = 150, overlay = true, className = '', children }) {
  const scrim = 'linear-gradient(180deg, rgba(8, 15, 28, 0.55), rgba(8, 15, 28, 0.78))'

  return (
    <div
      // Two different empty states, not one. With a photo the ground is dark,
      // so a slow-loading image resolves out of the scrim instead of flashing
      // white. With no photo at all - an equipment an admin has not given
      // artwork - a dark slab reads as a broken image; a quiet tint reads as
      // "nothing here yet", which is the truth.
      className={`relative flex items-end bg-cover bg-center ${src ? 'bg-slate-800' : 'bg-slate-100'} ${className}`.trim()}
      style={{
        height,
        backgroundImage: src ? `${overlay ? `${scrim}, ` : ''}url('${src}')` : undefined,
      }}
    >
      {children}
    </div>
  )
}
