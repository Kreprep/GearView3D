import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getEquipment, getTrainingModules } from './lib/api'
import { getModuleProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import { usePageTitle } from './hooks/usePageTitle'
import { useLanguage, useT } from './i18n'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import { moduleRoute } from './lib/router'
import PageLayout from './components/PageLayout'
import { StatusBadge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardMedia } from './components/ui/card'
import { PageState } from './components/ui/pageState'
import { ProgressBar } from './components/ui/progress'

// /training/modules - the module picker sitting between the hub and a
// module's guided simulation. Cards come straight from the Module rows, so an
// admin adding a module adds a card here with no code change.
function ModuleListPage({ user, onLogout, onBack, onNavigate }) {
  const [loaded, setLoaded] = useState({ done: false, equipment: null, modules: [], error: null })
  const { summary } = useProgress()
  const t = useT()
  const language = useLanguage()

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getTrainingModules()])
      .then(([equipmentRow, moduleRows]) => {
        if (cancelled) return
        setLoaded({ done: true, equipment: equipmentRow, modules: moduleRows, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setLoaded({ done: true, equipment: null, modules: [], error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { equipment, modules, error } = loaded
  const loading = !loaded.done

  const equipmentTitle = equipment?.title || 'Equipment'
  usePageTitle(t('moduleList.pageTitle', { equipment: equipmentTitle }))
  const openModule = (module) => onNavigate(moduleRoute(module.slug))

  const copy = resolveHubContent(equipment, hubContentContext({
    equipmentTitle,
    learnerName: user?.fullName || 'learner',
    moduleTitles: modules.map((module) => module.subtitle || module.title),
  }), language)

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> {t('moduleList.back')}
        </Button>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-ink">{copy.moduleListHeading}</h1>
      </div>

      <p className="m-0 text-[15px] text-body">{copy.moduleListIntro}</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {loading && <PageState>{t('moduleList.state.loading')}</PageState>}
        {!loading && error && <PageState tone="error">{t('moduleList.state.error', { error })}</PageState>}
        {!loading && !error && modules.length === 0 && <PageState>{t('moduleList.state.empty')}</PageState>}

        {!loading && !error && modules.map((module, index) => {
          const percentage = getModuleProgress(summary.raw, module.slug)
          const percentId = `module-percent-${module.id}`

          return (
            <Card key={module.id} padding="none" interactive stretchedAction>
              <CardMedia src={module.imageUrl}>
                {/* The step number is stencilled on the artwork, status chip
                    opposite it - the order is real (modules are sorted by
                    sortOrder) but nothing here is locked. */}
                <div className="flex w-full items-start justify-between gap-2 p-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-deep text-base font-extrabold text-white ring-1 ring-white/30"
                    aria-label={t('moduleList.stepNumber', { number: index + 1 })}
                  >
                    {index + 1}
                  </span>
                  <StatusBadge percent={percentage} />
                </div>
              </CardMedia>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="m-0 text-base font-extrabold tracking-tight text-ink">
                  {module.subtitle || module.title}
                </h2>
                <p className="m-0 text-[13.5px] leading-relaxed text-body">{module.description}</p>

                {/* mt-auto: descriptions run 4-7 lines, so without this the
                    meter and button land at a different height on every card. */}
                <div className="mt-auto grid gap-1.5 pt-3">
                  <span id={percentId} className="text-[13px] font-semibold text-muted">
                    {t('common.percentComplete', { percent: percentage })}
                  </span>
                  <ProgressBar value={percentage} labelledBy={percentId} size="sm" />
                  <Button stretched className="mt-1.5 w-full" variant="deep" onClick={() => openModule(module)}>
                    {t('moduleList.openModule')} <ArrowRight size={15} />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </PageLayout>
  )
}

export default ModuleListPage
