// The small label above a value or heading - the plate's field names, and the
// hub hero's equipment line.
//
// Sentence case, one typeface, no letterspacing. It reads as a label because it
// is smaller, heavier and a different colour than the thing beneath it, not
// because it is set in small caps in a second face. All-caps micro-labels cost
// reading speed (word shapes flatten to rectangles) and this audience is often
// reading in a second language.
const TONE_CLASSES = {
  light: 'text-accent-strong',
  deep: 'text-surface-deep-accent',
  muted: 'text-muted',
}

export function Kicker({ as: Tag = 'p', tone = 'light', className = '', children }) {
  return (
    <Tag
      className={`m-0 text-[13px] font-semibold ${TONE_CLASSES[tone] || TONE_CLASSES.light} ${className}`.trim()}
    >
      {children}
    </Tag>
  )
}
