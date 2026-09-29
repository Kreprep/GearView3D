import AppHeader from './AppHeader'
import './PageLayout.css'

/**
 * Canonical shell for every top-level page. Wrap page content in this
 * instead of hand-rolling a header + wrapper div.
 *
 * Reference implementations (follow these, not older pages):
 * - Hub page: TrainingHubPage.jsx (/training, the app's home screen: operator
 *   plate + numbered path)
 * - Card grid: ModuleListPage.jsx (/training/modules)
 * - Sub-page nested under a hub: GenericAssessmentPage.jsx
 *   (page-back-row + page-heading pattern, still plain CSS)
 * - Full-width simulation pages use SimulationPageLayout.jsx instead
 * - Intentional exception: NotFoundPage.jsx (centered error card, no PageLayout)
 *
 * The learner pages above are built from the primitives in components/ui/,
 * with Tailwind for layout - they have no stylesheets of their own. Compose
 * these rather than writing a new page CSS file:
 *
 *   Card / CardMedia   ui/card.jsx      surfaces; `tone="deep"` is the plate,
 *                                       `stretchedAction` + <Button stretched>
 *                                       makes a whole card one tab stop;
 *                                       `layout="grid"` for subgrid rows
 *   ProgressBar        ui/progress.jsx  every bar - it owns role/aria-valuenow
 *                                       and clamps NaN/out-of-range internally
 *   Badge/StatusBadge  ui/badge.jsx     status chips; StatusBadge maps a
 *                                       percentage to done/in-progress/todo
 *   Button             ui/button.jsx    `variant="deep"` on white,
 *                                       `variant="onDeep"` on the plate,
 *                                       `as="a"` for a real link
 *   Kicker             ui/kicker.jsx    the small label above a value
 *   PageState          ui/pageState.jsx loading / error / empty slot in a grid
 *   Stat, Meter        ui/stat.jsx      figure + caption, admin meter rows
 *
 * Rules learned from prior cleanup:
 * - Don't redefine width/padding/gap on a page container class - PageLayout.css
 *   already owns that via .page-layout.
 * - Never hand-roll role="button" + tabIndex + onKeyDown on a card that
 *   contains a real <button>: that is nested interactive content inside a
 *   widget role and two tab stops for one destination. Use Card's
 *   `stretchedAction` with <Button stretched> instead.
 * - Kickers only where they add context the heading does not already say.
 *   Don't stack one on every card - it reads as repetitive. On the hub the
 *   plate's fields carry them; the numbered path rows below do not, since each
 *   <h2> already names its step.
 * - To align a column across sibling cards - a stack of rows whose buttons
 *   should be one width - give the list `grid-cols-[...]` and each Card
 *   `layout="grid"` + `col-span-full grid-cols-subgrid`. The shared column
 *   sizes to the widest item, so it holds for any language and any label an
 *   admin types. Never hardcode a button width to fake it, and never pass a
 *   `grid`/`flex` class through Card's className - `layout` owns display,
 *   because two display utilities resolve by stylesheet order, not class order.
 * - One typeface (Plus Jakarta Sans) everywhere, and no small-caps labels.
 *   Hierarchy is size, weight and colour. Don't add a display face or an
 *   uppercase+letterspaced micro-label; both were tried and read as a separate,
 *   ill-fitting system. Heaviest weight is font-extrabold - the family stops at
 *   800 and font-synthesis is off, so font-black renders as nothing heavier.
 * - The app is laptop/desktop only, gated at 1024px in App.jsx. Design for
 *   1024px and up; there is no phone or portrait-tablet layout to maintain.
 * - Learner-facing strings go through t() / useT(); hub copy comes from
 *   resolveHubContent(equipment, context, language), never inlined.
 *
 * Pass `wide` for pages that host a large fixed-aspect element (e.g. a 3D
 * viewport) that gets cramped inside the default 1400px column - see
 * PartsIdentificationPage.jsx.
 */
function PageLayout({ user, onLogout, onNavigate, wide = false, className = '', children }) {
  return (
    <div className="page-shell">
      <AppHeader user={user} onLogout={onLogout} onNavigate={onNavigate} />
      <main className={`page-layout ${wide ? 'page-layout-wide' : ''} ${className}`.trim()}>{children}</main>
    </div>
  )
}

export default PageLayout
