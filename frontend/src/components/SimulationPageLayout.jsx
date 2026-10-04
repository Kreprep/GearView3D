import { ArrowLeft } from 'lucide-react'
import { useT } from '../i18n'
import LanguageToggle from './LanguageToggle'
import './SimulationPageLayout.css'

// The outer chrome every full-width simulation page shares: one top bar, then
// a <main> the page fills. This is the simulation-page counterpart of
// PageLayout (which is for standard content pages); the pages that use it
// render ModuleSimulationShell inside `children`.
//
// The bar holds the back button, the page's <h1>, whatever the page passes as
// `headerContent` (a module page's stepper and progress meter,
// ModuleHeaderContent) and the language toggle. It is the only bar: the shell
// below it has no title band or control bar of its own, so the scene gets the
// rest of the viewport.
function SimulationPageLayout({ title, backLabel, onBack, headerContent, className = '', children }) {
  const t = useT()
  return (
    <div className={`module-page-container ${className}`.trim()}>
      <header className="module-page-header">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel || t('module.backToModules')}
        </button>
        <h1 className="module-page-title" title={title}>{title}</h1>
        {headerContent && <div className="module-page-header-content">{headerContent}</div>}
        {/* These pages replace PageLayout, so they never mount AppHeader and
            had no way to switch language once a learner was inside a module. */}
        <LanguageToggle className="ml-auto shrink-0" />
      </header>

      <main className="wide-simulation-content">{children}</main>
    </div>
  )
}

export default SimulationPageLayout
