import AppHeader from './AppHeader'
import './PageLayout.css'

/**
 * Canonical shell for every top-level page. Wrap page content in this
 * instead of hand-rolling a header + wrapper div.
 *
 * Reference implementations (follow these, not older pages):
 * - Home/root page: ForkliftTrainingPage.jsx (hero + card grid pattern)
 * - Sub-page nested under a hub: AssessmentPage.jsx, EquipmentUsagePage.jsx,
 *   PartsIdentificationPage.jsx (page-back-row + page-heading pattern)
 * - Intentional exception: NotFoundPage.jsx (centered error card, no PageLayout)
 *
 * --- Pattern A: root/hub page (hero + card grid) ---
 *
 * <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
 *   <section className="forklift-training-hero">
 *     <div>
 *       <p className="forklift-training-kicker">{moduleName} Training</p>
 *       <h1>Welcome back, {user?.fullName}.</h1>
 *       <p>Short one-line description of this hub.</p>
 *     </div>
 *     <button className="continue-button" onClick={...}>Continue <ArrowRight size={16} /></button>
 *   </section>
 *
 *   <article className="overall-progress-card">
 *     <p className="forklift-training-kicker">Overall Progress</p>
 *     ...
 *   </article>
 *
 *   <section className="progress-grid">
 *     <article className="progress-card">
 *       <h2>Section Name</h2>
 *       <p>One-line description — no kicker here, the h2 already says it.</p>
 *     </article>
 *   </section>
 * </PageLayout>
 *
 * --- Pattern B: sub-page nested under a hub (back-row + heading) ---
 *
 * <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
 *   <div className="page-back-row">
 *     <button className="back-button" onClick={onBack}>Back to Modules</button>
 *     <h1 className="page-heading">{moduleName} - Section Name</h1>
 *   </div>
 *   <section className="assessment-card">...</section>
 * </PageLayout>
 *
 * Rules learned from prior cleanup:
 * - Don't redefine width/padding/gap on a page container class — PageLayout.css
 *   already owns that via .page-layout.
 * - Kickers (uppercase eyebrow labels like "OVERALL PROGRESS") should only
 *   appear where they add context the heading doesn't already say. Don't
 *   stack a kicker on every card — it reads as repetitive. In Pattern A above,
 *   the hero and overall-progress-card keep their kicker (each says something
 *   the h1 doesn't), but progress-card / recent-activity sections skip it
 *   since their own <h2> already names the section.
 */
function PageLayout({ user, onLogout, onNavigate, className = '', children }) {
  return (
    <div className="page-shell">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />
      <main className={`page-layout ${className}`.trim()}>{children}</main>
    </div>
  )
}

export default PageLayout
