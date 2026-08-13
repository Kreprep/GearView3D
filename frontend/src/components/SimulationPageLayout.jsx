import './SimulationPageLayout.css'

// The outer chrome every full-width simulation page shares: sticky header with
// a back button and title block, then a <main> the page fills. This is the
// simulation-page counterpart of PageLayout (which is for standard content
// pages); the pages that use it render ModuleSimulationShell or a 3D viewport
// inside `children`.
function SimulationPageLayout({ title, subtitle, backLabel = 'Back to Modules', onBack, className = '', children }) {
  return (
    <div className={`module-page-container ${className}`.trim()}>
      <header className="module-page-header">
        <button className="back-button" onClick={onBack}>
          {backLabel}
        </button>
        <div className="module-title-section">
          <h1>{title}</h1>
          {subtitle && <h2>{subtitle}</h2>}
        </div>
      </header>

      <main className="module-content wide-simulation-content">{children}</main>
    </div>
  )
}

export default SimulationPageLayout
