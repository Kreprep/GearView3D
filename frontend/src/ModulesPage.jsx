import { useEffect, useState } from 'react'
import { ArrowRight, CircleDashed, CircleCheck } from 'lucide-react'
import PageLayout from './components/PageLayout'
import { getEquipment } from './lib/api'
import { usePageTitle } from './hooks/usePageTitle'
import { useT } from './i18n'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardMedia } from './components/ui/card'
import { PageState } from './components/ui/pageState'

// Every equipment's training lives at the same data-driven route, so which
// cards are clickable is derived rather than listed: an equipment has training
// once an admin marks it available AND it actually has something behind the
// card - at least one module, or a 3D model for its identification page.
// That keeps a card from linking into an empty hub while letting a new
// equipment go live with no code change.
function trainingRouteFor(equipment) {
  if (equipment.available === false) return null
  if (!equipment.moduleCount && !equipment.modelUrl) return null
  return `/training/${equipment.id}`
}

function ModulesPage({ user, onLogout, onNavigate }) {
  const t = useT()
  usePageTitle(t('catalog.pageTitle'))
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getEquipment()
      .then(setEquipment)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Anything without a route - unavailable, or available but still empty -
  // renders as a "not ready" card.
  const ready = equipment.filter((item) => trainingRouteFor(item))
  const notReady = equipment.filter((item) => !trainingRouteFor(item))

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-ink">{t('catalog.heading')}</h1>
        <span className="text-[13px] font-semibold text-muted">
          {t('catalog.availableModels', { count: ready.length })}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {loading && <PageState>{t('catalog.state.loading')}</PageState>}
        {!loading && error && <PageState tone="error">{t('catalog.state.error', { error })}</PageState>}
        {!loading && !error && equipment.length === 0 && <PageState>{t('catalog.state.empty')}</PageState>}

        {!loading && !error && ready.map((item) => (
          // No role, no tabIndex, no keydown handler: the Button below carries
          // `stretched`, so its hit area is the whole card and there is one tab
          // stop with one accessible name. The old hand-rolled role="button"
          // wrapper contained a real <button>, which is nested interactive
          // content inside a widget role - two tab stops for one destination.
          <Card key={item.id} padding="none" interactive stretchedAction>
            <CardMedia src={item.imageUrl} />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 text-base font-extrabold tracking-tight text-ink">{item.title}</h2>
                <Badge tone="done" icon={CircleCheck}>{t('catalog.status.available')}</Badge>
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed text-body">{item.description}</p>
              {/* mt-auto keeps every card's action on one line across the row,
                  whatever length the admin's description runs to. */}
              <Button
                stretched
                className="mt-auto w-full"
                variant="deep"
                onClick={() => onNavigate(trainingRouteFor(item))}
              >
                {t('catalog.startTraining')} <ArrowRight size={15} />
              </Button>
            </div>
          </Card>
        ))}

        {!loading && !error && notReady.map((item) => (
          <Card key={item.id} padding="none" className="opacity-70">
            <CardMedia src={item.imageUrl} className="grayscale" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 text-base font-extrabold tracking-tight text-ink">{item.title}</h2>
                {/* `todo` is the tone .status-pill-soon never had: the class was
                    applied here but had no rule in any stylesheet, so this chip
                    rendered as an accidental unstyled grey. */}
                <Badge tone="todo" icon={CircleDashed}>{t('catalog.status.comingSoon')}</Badge>
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed text-body">
                {item.description || t('catalog.notReadyBody')}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </PageLayout>
  )
}

export default ModulesPage
