import { useT } from '../i18n'
import './ModuleLoadingState.css'

// Shown by equipment module pages while their driving courses are fetched, and
// when that fetch fails. The simulation shell must not render before the step
// list is known - see hooks/useModuleCourses.js.
function ModuleLoadingState({ loading, error }) {
  const t = useT()

  return (
    <div className="module-loading-state">
      {loading ? (
        <p>{t('module.loadingSteps')}</p>
      ) : (
        <>
          <p className="module-loading-error">{t('module.loadError')}</p>
          <p className="module-loading-detail">{error}</p>
        </>
      )}
    </div>
  )
}

export default ModuleLoadingState
