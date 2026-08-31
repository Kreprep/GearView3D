// The one progress bar. Every bar in the app was hand-rolled - a div with an
// inline width - and none of them carried role="progressbar" or an aria value,
// so a screen reader announced nothing at all. That is specified here once
// rather than at ~6 call sites that would each get it slightly wrong.
//
// Clamping and rounding are internal on purpose: computed percentages arrive
// NaN (0/0 with no checklist items) or above 100 (a deleted checklist item
// still sitting in saved progress), and the browser drops an out-of-range
// aria-valuenow silently rather than complaining.
// An unrecognised `size` is passed through as a class, the same escape hatch
// Button uses - so a caller whose height is genuinely different (the module
// shell's responsive clamp) sets it with one class instead of layering a
// second height utility over a named one, which would resolve by stylesheet
// order rather than by intent.
const SIZE_CLASSES = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const TONE_CLASSES = {
  // On white. The track token is the same slate the admin Meter used literally.
  progress: 'bg-status-track',
  // On the dark plate, where a slate-200 track is invisible.
  deep: 'bg-white/15',
}

const FILL_CLASSES = {
  progress: 'bg-status-progress',
  deep: 'bg-surface-deep-accent',
  done: 'bg-status-done',
}

function clampPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(Math.min(100, Math.max(0, number)))
}

// Pass EITHER `label` (an accessible name for a bar with no visible text) OR
// `labelledBy` (the id of the visible <span> that names it) - never both, which
// would announce twice, and never neither, which announces an anonymous bar.
export function ProgressBar({
  value,
  label,
  labelledBy,
  valueText,
  size = 'md',
  tone = 'progress',
  fill,
  className = '',
}) {
  const percent = clampPercent(value)

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText || `${percent}%`}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={`overflow-hidden rounded-full ${SIZE_CLASSES[size] || size} ${TONE_CLASSES[tone] || TONE_CLASSES.progress} ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${FILL_CLASSES[fill || tone] || FILL_CLASSES.progress}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
