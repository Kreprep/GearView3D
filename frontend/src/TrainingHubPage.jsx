import { useEffect, useState } from 'react'
import { ArrowRight, Gamepad2, RotateCcw } from 'lucide-react'
import { getEquipment, getHotspots, getQuizQuestions, getTrainingModules } from './lib/api'
import { getModulesProgress, getOverallProgress, getPartsProgress } from './lib/progressService'
import { useProgress } from './hooks/useProgress'
import { usePageTitle } from './hooks/usePageTitle'
import { useLanguage, useT } from './i18n'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import { routes } from './lib/router'
import PageLayout from './components/PageLayout'
import { ControllerSetup } from './components/driving/ControllerSetup'
import { StatusBadge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Kicker } from './components/ui/kicker'
import { PageState } from './components/ui/pageState'
import { ProgressBar } from './components/ui/progress'

const SURVEY_URL = 'https://forms.gle/HhadFBkLaruZ7quK6'

// The hub artwork from Equipment Settings (Equipment.imageUrl), etched into
// the plate.
//
// Those images are black technical line drawings on white - the parts-diagram
// vernacular this whole tool is about. Inverting gives white lines on black,
// and screen blending drops that black ground straight into the plate, so what
// survives is the wireframe itself rather than a photo pasted onto a panel. The
// mask fades it out before it reaches the copy, so nothing has to fight it for
// contrast.
//
// Decorative: it repeats the equipment named in the kicker and heading beside
// it, so it is aria-hidden rather than given alt text.
//
// Depends on Card's `overflow-hidden` to do the cropping - don't remove it.
function PlateArtwork({ src }) {
  if (!src) return null

  return (
    <div
      aria-hidden="true"
      // Deliberately taller and wider than the plate, and pushed off its right
      // edge: the Card clips it, so this reads as a crop of a much larger
      // drawing the panel is a window onto, rather than a small illustration
      // floating in the corner. Sized in % of the plate so it holds from a
      // 1024px laptop to a 4K display.
      className="pointer-events-none absolute -inset-y-[14%] right-[-4%] w-[56%]"
      style={{
        backgroundImage: `url('${src}')`,
        backgroundSize: 'contain',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
        filter: 'invert(1)',
        mixBlendMode: 'screen',
        opacity: 0.24,
        maskImage: 'linear-gradient(to right, transparent, black 38%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 38%)',
      }}
    />
  )
}

// One field on the operator plate: a small label over a value, hairline-ruled
// off from its neighbours.
function PlateField({ label, children, valueId }) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-6 first:border-l-0 first:pl-0">
      <Kicker tone="deep">{label}</Kicker>
      <p id={valueId} className="m-0 mt-0.5 max-w-[24ch] truncate text-xl font-extrabold text-white">
        {children}
      </p>
    </div>
  )
}

// One row of the numbered path. The number encodes real order - modules come
// before the parts they name, and the final check reviews both - but nothing
// is gated: every step is open from the start.
function PathStep({ number, title, description, percent, showBar, cta, onOpen, stepLabel }) {
  const percentId = `hub-step-${number}-percent`

  return (
    // The action sits on the title's own line rather than under the row. A hub
    // card is the full content width, so an action parked on a line of its own
    // left a band of empty card between the two - most obviously on the final
    // check, which has no meter to fill it.
    //
    // The three children map to the three subgrid columns declared on the
    // section: number, copy, action. Because the action column is shared across
    // all the rows, every button is exactly as wide as the widest label - no
    // hardcoded width to outgrow, in any language.
    <Card
      layout="grid"
      interactive
      stretchedAction
      className="col-span-full grid-cols-subgrid items-start gap-x-4"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-deep text-lg font-extrabold text-white"
        aria-label={stepLabel}
      >
        {number}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="m-0 text-base font-extrabold tracking-tight text-ink">{title}</h2>
          {showBar && <StatusBadge percent={percent} />}
        </div>
        <p className="m-0 mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-body">{description}</p>

        {showBar && (
          // Fixed 200px, not flex-1: a bar stretched across the full card is
          // harder to read a proportion off, and it competed with the plate's.
          <div className="mt-3 flex items-center gap-2.5">
            <ProgressBar value={percent} labelledBy={percentId} size="sm" className="w-[200px]" />
            <span id={percentId} className="text-[13px] font-semibold text-muted">
              {`${percent}%`}
            </span>
          </div>
        )}
      </div>

      <Button stretched variant="deep" className="w-full" onClick={onOpen}>
        {cta} <ArrowRight size={15} />
      </Button>
    </Card>
  )
}

// The training hub at /training - the app's home screen. It lists sections,
// not modules: the Training Modules step opens /training/modules
// (ModuleListPage), which is where the per-module cards live.
//
// The page is one operator plate - the dark stamped panel carrying who you are,
// how far you are and the single Continue action - followed by a flat numbered
// path. One bold thing, then discipline. All of its copy comes from
// resolveHubContent(), so don't inline strings here.
function TrainingHubPage({ user, onLogout, onNavigate }) {
  const [equipment, setEquipment] = useState(null)
  const [modules, setModules] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [hasPartsQuiz, setHasPartsQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [controllerSetupOpen, setControllerSetupOpen] = useState(false)
  const { summary, resetProgress } = useProgress()
  const t = useT()
  const language = useLanguage()

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getEquipment(),
      getTrainingModules(),
      getHotspots('parts'),
      // The parts quiz is optional - having no questions is not an error - so
      // this one call swallows its own failure. The other three are the page.
      getQuizQuestions({ context: 'parts' }).catch(() => []),
    ])
      .then(([equipmentRow, moduleRows, hotspotRows, partsQuestions]) => {
        if (cancelled) return
        setEquipment(equipmentRow)
        setModules(moduleRows)
        setHotspots(hotspotRows)
        setHasPartsQuiz(partsQuestions.length > 0)
        setError(null)
        setLoading(false)
      })
      // Without this the page sat on "Loading modules..." forever whenever any
      // of the three required calls rejected - the backend down, the session
      // expired - with nothing on screen to say so.
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const equipmentTitle = equipment?.title || 'Equipment'
  usePageTitle(t('hub.pageTitle', { equipment: equipmentTitle }))
  // The parts page exists once there is a published part marker to show -
  // the same rule GenericAssessmentPage and the Hub Content editor use.
  const hasPartsPage = hotspots.length > 0
  const partsProgress = getPartsProgress(
    summary.raw,
    hotspots.map((hotspot) => hotspot.id),
    hasPartsQuiz,
  )
  const moduleSlugs = modules.map((module) => module.slug)
  const moduleProgress = getModulesProgress(summary.raw, moduleSlugs)

  const overall = getOverallProgress(summary.raw, moduleSlugs, hasPartsPage ? partsProgress : null)
  const continueTarget = modules.length ? routes.modules : hasPartsPage ? routes.parts : null

  const copy = resolveHubContent(equipment, hubContentContext({
    equipmentTitle,
    learnerName: user?.fullName || 'learner',
    hasPartsPage,
    moduleTitles: modules.map((module) => module.subtitle || module.title),
  }), language)

  // The plate's NEXT field: the first step still short of 100%, named in the
  // learner's own words rather than a route.
  const nextLabel = moduleProgress < 100
    ? copy.modulesTitle
    : hasPartsPage && partsProgress < 100
      ? copy.partsTitle
      : overall < 100
        ? copy.assessmentTitle
        : t('hub.plate.nextDone')

  // Numbered at render time, so a hub with no parts page reads 1, 2 - never
  // 1, 3.
  const steps = [
    modules.length > 0 && {
      id: 'modules',
      title: copy.modulesTitle,
      description: copy.modulesDescription,
      percent: moduleProgress,
      showBar: true,
      cta: copy.modulesCta,
      onOpen: () => onNavigate(routes.modules),
    },
    hasPartsPage && {
      id: 'parts',
      title: copy.partsTitle,
      description: copy.partsDescription,
      percent: partsProgress,
      showBar: true,
      cta: copy.partsCta,
      onOpen: () => onNavigate(routes.parts),
    },
    {
      id: 'assessment',
      title: copy.assessmentTitle,
      description: copy.assessmentDescription,
      percent: overall,
      // The final check reviews what came before rather than tracking its own
      // completion, so it carries no bar or status chip of its own.
      showBar: false,
      cta: copy.assessmentCta,
      onOpen: () => onNavigate(routes.assessment),
    },
  ].filter(Boolean)

  if (loading || error) {
    return (
      <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
        {error
          ? <PageState tone="error">{t('hub.state.error', { error })}</PageState>
          : <PageState>{t('hub.state.loadingModules')}</PageState>}
      </PageLayout>
    )
  }

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      {/* The operator plate. Once per page - everything below it is flat white. */}
      <Card tone="deep" padding="none" className="relative">
        <PlateArtwork src={equipment?.imageUrl} />

        {/* The copy column is capped so the artwork has room and so the
            progress bar reads as a proportion rather than as a rule across the
            whole page. Without artwork it relaxes - a 620px column stranded in
            a 1300px panel is the dead space this replaced. */}
        <div className={`relative grid gap-5 p-6 ${equipment?.imageUrl ? 'max-w-[620px]' : ''}`}>
          <div>
            <Kicker tone="deep">{copy.kicker}</Kicker>
            <h1 className="m-0 mt-1.5 text-2xl font-extrabold tracking-tight text-white">{copy.heading}</h1>
            <p className="m-0 mt-1.5 text-[15px] text-white/70">{copy.intro}</p>
          </div>

          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <PlateField label={copy.overallTitle} valueId="hub-overall-percent">{`${overall}%`}</PlateField>
            <PlateField label={t('hub.plate.next')}>{nextLabel}</PlateField>
          </div>

          <div>
            {/* Named by the PROGRESS field above, not by a label of its own -
                ProgressBar takes label XOR labelledBy, never both. */}
            <ProgressBar value={overall} labelledBy="hub-overall-percent" tone="deep" size="lg" />
            <p className="m-0 mt-2.5 text-xs text-white/50">{copy.overallDescription}</p>
          </div>

          {continueTarget && (
            <Button variant="onDeep" size="lg" className="justify-self-start" onClick={() => onNavigate(continueTarget)}>
              {copy.continueLabel} <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </Card>

      {/* The three columns the path rows share: number, copy, action. Each row
          is a subgrid of this, so the action column is sized once - to the
          widest button across all the rows - instead of every button sizing to
          its own label and leaving a ragged left edge down the column. */}
      <section
        className="grid grid-cols-[auto_1fr_auto] gap-3"
        aria-label={t('hub.progressLabel')}
      >
        {steps.map((step, index) => (
          <PathStep
            key={step.id}
            number={index + 1}
            stepLabel={t('hub.stepNumber', { number: index + 1 })}
            {...step}
          />
        ))}

        {steps.length === 1 && !hasPartsPage && <PageState>{t('hub.state.noModules')}</PageState>}
      </section>

      {/* The survey was an accent-ringed, pulsing band competing with Continue
          for the same attention. It is a real ask, not a training step, so it
          sits at the page foot as a quiet link. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[13px]">
        <p className="m-0 text-muted">
          {copy.activityTitle}{' '}
          <Button as="a" variant="ghost" size="sm" href={SURVEY_URL} target="_blank" rel="noopener noreferrer">
            {t('hub.survey')}
          </Button>
        </p>
        <div className="flex flex-wrap gap-2">
          {/* The wheel is set up before driving, so Controller Setup is
              reachable here as well as from the driving screen. */}
          <Button variant="ghost" size="sm" onClick={() => setControllerSetupOpen(true)}>
            <Gamepad2 size={15} /> {t('controller.open')}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetProgress}>
            <RotateCcw size={15} /> {t('hub.resetProgress')}
          </Button>
        </div>
      </div>
      {controllerSetupOpen && <ControllerSetup onClose={() => setControllerSetupOpen(false)} />}
    </PageLayout>
  )
}

export default TrainingHubPage
