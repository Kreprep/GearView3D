// Replaces the `<label>Title<input/></label>` pattern repeated across
// AdminDashboard, ModuleEditor, CourseEditor, VehicleProfileEditor.
export function Field({ label, children, note, className = '' }) {
  return (
    <label className={`grid gap-1.5 text-[13.5px] font-bold text-body ${className}`.trim()}>
      {label}
      {children}
      {note && <span className="text-xs font-medium leading-snug text-muted">{note}</span>}
    </label>
  )
}
