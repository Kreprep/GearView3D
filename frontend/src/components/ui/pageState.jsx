// The "Loading...", "could not be loaded: {error}" and "nothing here yet" slot
// every learner list page repeats. Each page had its own single-purpose class
// (.catalog-state, .module-list-state, .progress-grid-empty) that rendered the
// same box in the same place.
//
// `span` matters because these sit *inside* the card grid: without it the
// message renders in one column's width beside empty track.
const TONE_CLASSES = {
  info: 'border-border bg-panel text-muted',
  error: 'border-red-200 bg-red-50 text-red-700',
}

export function PageState({ tone = 'info', span = true, className = '', children }) {
  return (
    <p
      // Announced when it replaces earlier content - a fetch that fails after
      // the page has rendered is otherwise a silent swap for a screen reader.
      role={tone === 'error' ? 'alert' : 'status'}
      className={[
        'm-0 rounded-2xl border px-4 py-6 text-center text-sm font-semibold',
        TONE_CLASSES[tone] || TONE_CLASSES.info,
        span ? 'col-span-full' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </p>
  )
}
