// The Overview tab's stat cards and completion bars.
export function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-panel p-4">
      {Icon && (
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
          <Icon size={20} />
        </span>
      )}
      <div>
        <strong className="block text-[28px] font-black leading-tight text-ink">{value}</strong>
        <p className="mt-0.5 text-[13px] font-bold text-muted">{label}</p>
      </div>
    </div>
  )
}

export function Meter({ label, value, valueLabel }) {
  return (
    <div className="grid grid-cols-[minmax(160px,300px)_1fr_44px] items-center gap-3 max-[760px]:grid-cols-1 max-[760px]:gap-1">
      <span className="text-[13px] font-bold leading-tight text-body">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent-strong" style={{ width: `${value}%` }} />
      </div>
      <span className="text-right text-[13px] font-bold text-muted max-[760px]:text-left">
        {valueLabel ?? `${value}%`}
      </span>
    </div>
  )
}
