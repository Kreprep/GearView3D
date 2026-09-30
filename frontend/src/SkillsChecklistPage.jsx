import { useEffect, useMemo, useState } from 'react'
import { Check, Circle, Printer } from 'lucide-react'
import { getEquipment, getMySkills, getSkills, getTrainingModules } from './lib/api'
import { usePageTitle } from './hooks/usePageTitle'
import { useLanguage, useT } from './i18n'
import { hubContentContext, resolveHubContent } from './lib/hubContent'
import { SKILL_CATEGORIES, skillsPercentage } from './lib/skillProgress'
import { describeEvidence, formatSkillDate, skillCategoryKey } from './lib/skillText'
import { SKILL_MAPPING_REVIEWED } from './data/skillDefaults.js'
import PageLayout from './components/PageLayout'
import MarkdownContent from './components/MarkdownContent'
import { SkillStatusBadge } from './components/SkillStatusBadge'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Kicker } from './components/ui/kicker'
import { PageState } from './components/ui/pageState'
import { ProgressBar } from './components/ui/progress'

const NOT_SIMULATED_KEYS = [
  'skills.notSimulated.trailer',
  'skills.notSimulated.maintenance',
  'skills.notSimulated.ppe',
  'skills.notSimulated.basic',
]

// The instructor's stamp on a signed-off skill: who and when, never the note.
function SignoffStamp({ signoff, t, language }) {
  if (!signoff) return null
  const values = { name: signoff.actorName, date: formatSkillDate(signoff.createdAt, language) }
  return (
    <p className="m-0 text-[13px] font-semibold text-status-done">
      {t(signoff.actorRemoved ? 'skills.stampFormer' : 'skills.stamp', values)}
    </p>
  )
}

function EvidenceList({ evidence, t }) {
  if (!evidence.length) return <p className="m-0 text-[13px] text-muted">{t('skills.evidence.none')}</p>

  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {evidence.map(({ rule, met }, index) => (
        <li key={index} className="flex items-start gap-2 text-[13.5px] text-body">
          {met
            ? <Check size={16} className="mt-0.5 flex-none text-status-done" aria-hidden="true" />
            : <Circle size={16} className="mt-0.5 flex-none text-slate-300" aria-hidden="true" />}
          <span>
            <span className="sr-only">{`${t(met ? 'skills.evidence.met' : 'skills.evidence.notMet')}: `}</span>
            {describeEvidence(rule, t)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SkillCard({ skill, result, moduleTitles, t, language }) {
  const practisedIn = skill.modules
    .filter((link) => link.relation === 'teaches')
    .map((link) => moduleTitles[link.moduleSlug])
    .filter(Boolean)

  return (
    <Card className="gap-3 break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 text-base font-extrabold tracking-tight text-ink">{skill.title}</h3>
        <SkillStatusBadge status={result?.status || 'not-started'} t={t} />
      </div>
      {skill.description && <p className="m-0 max-w-[70ch] text-[13.5px] leading-relaxed text-body">{skill.description}</p>}

      <div>
        <p className="m-0 mb-1.5 text-[13px] font-bold text-ink">{t('skills.evidence.heading')}</p>
        <EvidenceList evidence={result?.evidence || []} t={t} />
      </div>

      <SignoffStamp signoff={result?.signoff} t={t} language={language} />

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {practisedIn.length > 0 && <span>{t('skills.practisedIn', { modules: practisedIn.join(', ') })}</span>}
        {skill.tesdaRef && <span>{t('skills.tesdaRef', { ref: skill.tesdaRef })}</span>}
      </div>
    </Card>
  )
}

// /training/skills - the Skills Checklist (plan 4.8): the TESDA entry
// requirements, then every skill grouped by category with its status, the
// evidence met, the modules that teach it and the instructor's stamp, then
// what GearView leaves to hands-on training. Judged on the server by the same
// lib/skillProgress.js the instructor's view uses. Print-friendly: the header
// and buttons drop out and cards do not split across pages.
function SkillsChecklistPage({ user, onLogout, onNavigate }) {
  const t = useT()
  const language = useLanguage()
  const [state, setState] = useState({ loading: true, error: null, equipment: null, modules: [], skills: [], results: [] })

  useEffect(() => {
    let cancelled = false

    Promise.all([getEquipment(), getTrainingModules(), getSkills(), getMySkills()])
      .then(([equipment, modules, skills, mine]) => {
        if (!cancelled) setState({ loading: false, error: null, equipment, modules, skills, results: mine.results })
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false, error: error.message }))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const equipmentTitle = state.equipment?.title || 'Equipment'
  usePageTitle(t('skills.pageTitle', { equipment: equipmentTitle }))

  const copy = resolveHubContent(
    state.equipment,
    hubContentContext({ equipmentTitle, learnerName: user?.fullName || 'learner' }),
    language,
  )
  const moduleTitles = useMemo(
    () => Object.fromEntries(state.modules.map((module) => [module.slug, module.title])),
    [state.modules],
  )
  const resultById = useMemo(
    () => Object.fromEntries(state.results.map((result) => [result.skillId, result])),
    [state.results],
  )
  const groups = SKILL_CATEGORIES.map((category) => ({
    category,
    skills: state.skills.filter((skill) => skill.category === category),
  })).filter((group) => group.skills.length)

  const percent = skillsPercentage(state.results)
  const done = state.results.filter((result) => result.status === 'demonstrated' || result.status === 'signed-off').length

  if (state.loading || state.error) {
    return (
      <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
        {state.error
          ? <PageState tone="error">{t('skills.state.error', { error: state.error })}</PageState>
          : <PageState>{t('skills.state.loading')}</PageState>}
      </PageLayout>
    )
  }

  return (
    <PageLayout user={user} onLogout={onLogout} onNavigate={onNavigate}>
      <Card className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>{t('skills.kicker')}</Kicker>
            <h1 className="m-0 mt-1 text-2xl font-extrabold tracking-tight text-ink">{copy.skillsPageHeading}</h1>
            <p className="m-0 mt-1.5 max-w-[70ch] text-[15px] text-body">{copy.skillsPageIntro}</p>
          </div>
          <Button variant="ghost" size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer size={15} /> {t('skills.print')}
          </Button>
        </div>
        {state.results.length > 0 && (
          <div className="flex items-center gap-3">
            <ProgressBar value={percent} labelledBy="skills-summary" className="max-w-[320px] flex-1" />
            <span id="skills-summary" className="text-[13px] font-semibold text-muted">
              {t('skills.summary', { done, total: state.results.length })}
            </span>
          </div>
        )}
      </Card>

      <Card className="gap-2 break-inside-avoid">
        <h2 className="m-0 text-lg font-extrabold tracking-tight text-ink">{copy.entryRequirementsTitle}</h2>
        <MarkdownContent>{copy.entryRequirements}</MarkdownContent>
        <p className="m-0 max-w-[80ch] text-[13px] text-muted">{copy.entryRequirementsNote}</p>
      </Card>

      {!groups.length && <PageState>{t('skills.state.empty')}</PageState>}

      {groups.map(({ category, skills }) => (
        <section key={category} className="grid gap-3" aria-labelledby={`skills-${category}`}>
          <h2 id={`skills-${category}`} className="m-0 mt-2 text-lg font-extrabold tracking-tight text-ink">
            {t(skillCategoryKey(category))}
          </h2>
          <div className="grid grid-cols-2 gap-3 print:block print:space-y-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                result={resultById[skill.id]}
                moduleTitles={moduleTitles}
                t={t}
                language={language}
              />
            ))}
          </div>
        </section>
      ))}

      <Card className="gap-2 break-inside-avoid">
        <h2 className="m-0 text-lg font-extrabold tracking-tight text-ink">{t('skills.notSimulated.heading')}</h2>
        <ul className="m-0 grid gap-1 pl-5 text-[13.5px] text-body">
          {NOT_SIMULATED_KEYS.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
      </Card>

      <div className="grid gap-1 text-xs text-muted">
        <p className="m-0">{t('skills.note.clientReported')}</p>
        {!SKILL_MAPPING_REVIEWED && <p className="m-0">{t('skills.note.draftMapping')}</p>}
      </div>
    </PageLayout>
  )
}

export default SkillsChecklistPage
