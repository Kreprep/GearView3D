// One focus ring, one disabled state, shared by every text control in the
// admin UI.
// font-normal is load-bearing: every one of these sits inside a <label>
// that is font-bold (Field, and the login page's own labels), and a control
// with no weight of its own inherits it - which made placeholder text read
// as a filled-in value.
const CONTROL_CLASSES = 'w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-sm font-normal text-ink placeholder:text-muted transition focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60'

export function Input({ className = '', ...props }) {
  return <input className={`${CONTROL_CLASSES} ${className}`.trim()} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${CONTROL_CLASSES} min-h-24 resize-y ${className}`.trim()} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${CONTROL_CLASSES} ${className}`.trim()} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`flex items-center gap-2 text-[13.5px] font-semibold text-body ${className}`.trim()}>
      <input type="checkbox" className="h-4 w-4 accent-accent" {...props} />
      {label}
    </label>
  )
}
