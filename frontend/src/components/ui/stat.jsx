import { ProgressBar } from './progress'

// The Overview tab's stat cards, and the hub's big figure + caption.
const TONE_CLASSES = {
  light: {
    wrap: 'border-border bg-panel',
    icon: 'bg-accent-soft text-accent-strong',
    value: 'text-ink',
    label: 'text-muted',
  },
  // On the operator plate.
  deep: {
    wrap: 'border-white/10 bg-white/5',
    icon: 'bg-white/10 text-surface-deep-accent',
    value: 'text-white',
    label: 'text-white/60',
  },
}

export function Stat({ icon: Icon, value, label, tone = 'light' }) {
  const classes = TONE_CLASSES[tone] || TONE_CLASSES.light

  return (
    <div className={`flex items-center gap-3.5 rounded-xl border p-4 ${classes.wrap}`}>
      {Icon && (
        <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl ${classes.icon}`}>
          <Icon size={20} />
        </span>
      )}
      <div>
        <strong className={`block text-[28px] font-extrabold leading-tight ${classes.value}`}>{value}</strong>
        <p className={`mt-0.5 text-[13px] font-bold ${classes.label}`}>{label}</p>
      </div>
    </div>
  )
}

// The admin Overview's per-module completion rows. The grid, the props and the
// one call site are unchanged; only the bar itself moved into ProgressBar, so
// this list gets role/aria-valuenow it never had.
export function Meter({ label, value, valueLabel }) {
  return (
    <div className="grid grid-cols-[minmax(160px,300px)_1fr_44px] items-center gap-3 max-[760px]:grid-cols-1 max-[760px]:gap-1">
      <span className="text-[13px] font-bold leading-tight text-body">{label}</span>
      <ProgressBar value={value} label={label} valueText={valueLabel ?? `${value}%`} />
      <span className="text-right text-[13px] font-bold text-muted max-[760px]:text-left">
        {valueLabel ?? `${value}%`}
      </span>
    </div>
  )
}
