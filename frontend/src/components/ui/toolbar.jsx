// Replaces .admin-row-actions - a left-aligned row of buttons under a panel
// or list item.
export function Toolbar({ children, className = '' }) {
  return <div className={`mt-2.5 flex flex-wrap items-center gap-2.5 ${className}`.trim()}>{children}</div>
}
