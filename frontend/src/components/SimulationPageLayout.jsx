import { useT } from '../i18n'
import './SimulationPageLayout.css'

// The outer chrome every full-width simulation page shares: sticky header with
// a back button and title block, then a <main> the page fills. This is the
// simulation-page counterpart of PageLayout (which is for standard content
// pages); the pages that use it render ModuleSimulationShell or a 3D viewport
// inside `children`.
//
// `compact` is for pages whose content already prints the title - every page
// rendering ModuleSimulationShell does, in its briefing bar. There the header
// would repeat the title one line above it and cost ~45px of scene height, so
// compact mode keeps only the back button and the subtitle as a context label,
// and the shell's own <h1> is the page heading.
function SimulationPageLayout({
  title,
  subtitle,
  backLabel,
  onBack,
  className = '',
  compact = false,
  children,
}) {
  const t = useT()
  return (
    <div className={`module-page-container ${className}`.trim()}>
      <header className={`module-page-header ${compact ? 'is-compact' : ''}`.trim()}>
        <button className="back-button" onClick={onBack}>
          {backLabel || t('module.backToModules')}
        </button>
        {compact ? (
          subtitle && <p className="module-page-context">{subtitle}</p>
        ) : (
          <div className="module-title-section">
            <h1>{title}</h1>
            {subtitle && <h2>{subtitle}</h2>}
          </div>
        )}
      </header>

      <main className="wide-simulation-content">{children}</main>
    </div>
  )
}

export default SimulationPageLayout
