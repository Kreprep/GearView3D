export function Card({ children, className = '', ...props }) {
  return (
    <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()} {...props}>
      {children}
    </article>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
