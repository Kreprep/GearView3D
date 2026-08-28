// Replaces .admin-save-message - an overlay instead of an inline block, so it
// no longer shifts the layout when it appears. Timer cleanup for how long it
// stays up lives with the caller's setTimeout ref (see AdminDashboard.jsx's
// refreshMessage), the same pattern as every other admin timer.
export function Toast({ children }) {
  if (!children) return null

  return (
    <div className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg">
      {children}
    </div>
  )
}
