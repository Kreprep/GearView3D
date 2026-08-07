import './ModuleLoadingState.css'

// Shown by equipment module pages while their driving courses are fetched, and
// when that fetch fails. The simulation shell must not render before the step
// list is known - see hooks/useModuleCourses.js.
function ModuleLoadingState({ loading, error }) {
  return (
    <div className="module-loading-state">
      {loading ? (
        <p>Loading module steps...</p>
      ) : (
        <>
          <p className="module-loading-error">This module's steps could not be loaded.</p>
          <p className="module-loading-detail">{error}</p>
        </>
      )}
    </div>
  )
}

export default ModuleLoadingState
