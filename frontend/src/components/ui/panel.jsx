// Replaces .admin-panel / .admin-panel-heading / .admin-panel-note / .wide-panel.
export function Panel({ children, className = '', wide = false, ...props }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-border bg-panel p-5 shadow-sm ${wide ? 'col-span-full' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  )
}

export function PanelHeader({ children, className = '', actions }) {
  if (!actions) {
    return <h2 className={`mb-3.5 text-[17px] font-extrabold tracking-tight text-ink ${className}`.trim()}>{children}</h2>
  }

  return (
    <div className={`mb-3.5 flex flex-wrap items-center justify-between gap-2.5 ${className}`.trim()}>
      <h2 className="text-[17px] font-extrabold tracking-tight text-ink">{children}</h2>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export function PanelNote({ children, className = '' }) {
  return <p className={`text-[13px] leading-relaxed text-muted ${className}`.trim()}>{children}</p>
}
