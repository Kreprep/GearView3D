import { useEffect, useMemo, useRef, useState } from 'react'
import DrivingSimulationViewer from './components/DrivingSimulationViewer'
import CabInspectionViewer from './components/inspection/CabInspectionViewer'
import ModuleLoadingState from './components/ModuleLoadingState'
import ModuleSimulationShell from './components/ModuleSimulationShell'
import { ModuleHeaderContent } from './components/ModuleStepper'
import ModuleSummary from './components/ModuleSummary'
import SimulationPageLayout from './components/SimulationPageLayout'
import { BriefingScene, BriefingTask } from './components/ModuleBriefing'
import ScopeNoticeModal from './components/ScopeNoticeModal'
import { ModuleSkills } from './components/ModuleSkills'
import { ReportingActivity, ShutdownSequenceActivity } from './components/ModuleActivities'
import { ACTIVITY_IDS } from './lib/activitySteps'
import { ChecklistScene, ModuleRowsTask, QuizScene } from './components/ModuleChecklistStep'
import { WalkAroundScene, WalkAroundTask } from './components/WalkAroundStep'
import { walkAroundDefectOverlays } from './data/viewerHotspots'
import { getEquipment } from './lib/api'
import { useLanguage, useT } from './i18n'
import { PHASE_TITLE_KEYS, phaseStateFor } from './lib/walkAroundStep'
import { resolveVehicleProfile } from './lib/vehicleProfile'
import { useActivityController } from './hooks/useActivityController'
import { useDrivingController } from './hooks/useDrivingController'
import { useWalkAroundController } from './hooks/useWalkAroundController'
import { useModuleCourses } from './hooks/useModuleCourses'
import { useModuleSkills } from './hooks/useModuleSkills'
import { useModuleRecord } from './hooks/useModuleRecord'
import { usePageTitle } from './hooks/usePageTitle'
import { useProgress } from './hooks/useProgress'
import { moduleObjectives, nextModuleRoute } from './lib/moduleContent'
import { routes } from './lib/router'
import { buildSimulationState, isStepComplete, withStepComplete } from './lib/simulationProgress'
import { equipmentUsageModules } from './lib/trainingData'
import { can } from './data/permissions.js'
import './GenericModulePage.css'

const NEXT_MODULE_DELAY_MS = 1400

// The engine-on walk-around phase runs in the cab, on the driving simulation.
const isCabStep = (step) => step?.kind === 'walk-around' && step.walkAround?.phase === 'engine-on'

// The one module page for every equipment's course-backed modules, Forklift
// included - it renders whatever typed step rows the module has (briefing,
// driving, checklist, quiz, activity, summary), so the only module page left
// outside it is Forklift's hardcoded Walk-Around Check.
//
// `driving`-kind steps render through DrivingSimulationViewer with the
// forklift's vehicle profile (footprint, seat, HUD copy, fail messages - see
// lib/vehicleProfile.js), and so does the engine-on walk-around phase,
// through CabInspectionViewer.
//
// Per-step-kind behaviour lives in three controller hooks rather than here:
// useWalkAroundController (inspection markers, checks/gauges/scenarios),
// useDrivingController (the DrivingSimulationViewer event handler and task
// copy) and useActivityController (the two built-in Module 3 screens). This
// component owns what every step kind shares - the simulation snapshot,
// grading, step navigation - and wires the three together.
function GenericModulePage({ moduleSlug, user, onBack, onNavigate }) {
  const t = useT()
  const language = useLanguage()
  // The viewers' authoring tools (free camera, colliders) are for whoever
  // edits the content, so they follow content.edit rather than a role.
  const showAuthoringTools = can(user, 'content.edit')
  // Forklift's modules keep their static definitions as the fallback record
  // (objectives, fullTitle); admin-created modules fall back to a blank
  // fullTitle deliberately - useModuleRecord only overrides a field when the
  // DB row has a non-empty value, so a non-blank fallback would permanently
  // shadow a row whose fullTitle hasn't been filled in yet.
  const module = useModuleRecord(
    moduleSlug,
    equipmentUsageModules.find((item) => item.slug === moduleSlug) || { title: 'Module', fullTitle: '' },
  )
  const { steps, stepById, courseById, loading, error } = useModuleCourses(moduleSlug)
  const moduleSkills = useModuleSkills(moduleSlug)
  const { progress, updateSimulation } = useProgress()
  const savedSimulation = progress.simulations[moduleSlug] || {}
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [equipmentRecord, setEquipmentRecord] = useState(null)
  const [showScopeNotice, setShowScopeNotice] = useState(true)
  const completeModuleTimer = useRef(null)

  // Walk-around steps need this module's inspection markers; every other
  // module skips the request entirely.
  const hasWalkAround = steps.some((step) => step.kind === 'walk-around')

  // Driving steps and the cab need the equipment row for its vehicle profile
  // overrides.
  const hasDriving = steps.some((step) => step.kind === 'driving' || isCabStep(step))

  useEffect(() => {
    if (!hasDriving) return undefined

    getEquipment()
      .then(setEquipmentRecord)
      .catch(() => {})

    return undefined
  }, [hasDriving])

  // Keyed on language too: the profile carries the HUD legend and the fail
  // messages, so a toggle has to rebuild it.
  const vehicleProfile = useMemo(
    () => resolveVehicleProfile(equipmentRecord, language),
    [equipmentRecord, language],
  )

  useEffect(() => () => clearTimeout(completeModuleTimer.current), [])

  // Steps backed by a driving course are graded, as are walk-around steps and
  // the built-in activities; briefing, checklist, quiz and summary are not.
  const gradedStepIds = useMemo(
    () =>
      steps
        .filter(
          (step) =>
            courseById[step.id] ||
            step.kind === 'walk-around' ||
            (step.kind === 'activity' && ACTIVITY_IDS.includes(step.content?.activityId)),
        )
        .map((step) => step.id),
    [steps, courseById],
  )
  const simulation = buildSimulationState(
    {
      ...savedSimulation,
      engineStarted: savedSimulation.engineStarted || false,
      keysUsedByStep: savedSimulation.keysUsedByStep || {},
      failedAttempts: savedSimulation.failedAttempts || 0,
      shutdownMistakes: savedSimulation.shutdownMistakes || 0,
    },
    gradedStepIds,
  )

  const saveSimulation = (partial) => {
    const next = buildSimulationState({ ...simulation, ...partial }, gradedStepIds)
    updateSimulation(moduleSlug, next)
    return next
  }

  const markStepComplete = (stepId, partial = {}) =>
    saveSimulation({ ...partial, ...withStepComplete(simulation, stepId) })

  // Steps arrive after the first render and an admin can delete one, so the
  // saved index is clamped rather than indexed into blindly.
  const stepIndex = Math.min(currentStepIndex, Math.max(steps.length - 1, 0))

  const changeStep = (nextIndex) => {
    drivingController.setLastFail(null)
    walkAroundController.setSelectedDetail(null)
    walkAroundController.setFocusedHotspotId(null)
    setCurrentStepIndex(nextIndex)
  }

  const walkAroundController = useWalkAroundController({
    hasWalkAround,
    moduleSlug,
    steps,
    gradedStepIds,
    simulation,
    updateSimulation,
    changeStep,
  })
  const {
    hotspots,
    hotspotsLoading,
    hotspotsError,
    selectedDetail,
    setSelectedDetail,
    focusedHotspotId,
    handleCheck,
    handleGauge,
    handleCabEvent,
    handleWalkAroundHotspot,
    walkAroundHandlers,
    scenarioIdFor,
    nextWalkAroundItem,
  } = walkAroundController

  const drivingController = useDrivingController({
    moduleSlug,
    courseById,
    simulation,
    gradedStepIds,
    saveSimulation,
    markStepComplete,
    updateSimulation,
  })
  const { handleDrivingEvent, renderDrivingTask } = drivingController

  const activityController = useActivityController({ steps, simulation, saveSimulation })
  const {
    shutdownComplete,
    reportingComplete,
    shutdownActions,
    shutdownDisplayOrder,
    reportPrompts,
    shutdownPicked,
    wrongPickId,
    reportAnswers,
    handleShutdownPick,
    handleReportAnswer,
    renderShutdownTask,
    renderReportingTask,
  } = activityController

  const completeModule = () => {
    if (!simulation.complete && gradedStepIds.length > 0) return

    // The summary step's stored nextRoute wins when it resolves; otherwise
    // return to the equipment's module list to pick the next one.
    clearTimeout(completeModuleTimer.current)
    completeModuleTimer.current = setTimeout(
      () => onNavigate?.(nextModuleRoute(steps) || routes.modules),
      NEXT_MODULE_DELAY_MS,
    )
  }

  const getStepCanProceed = (stepId) =>
    gradedStepIds.includes(stepId) ? isStepComplete(simulation, stepId) : true

  // How far into the step list a learner may jump directly from the stepper:
  // up to and including the first graded step they have not finished yet, so
  // e.g. Engine-On stays reachable once Engine-Off is done without letting
  // them skip past an incomplete required step.
  const maxSelectableStepIndex = (() => {
    const frontier = steps.findIndex((step) => gradedStepIds.includes(step.id) && !isStepComplete(simulation, step.id))
    return frontier === -1 ? steps.length - 1 : frontier
  })()

  // The stepper's tick: a graded step once it is finished, any other step
  // once the learner is past it.
  const isStepDone = (index) =>
    gradedStepIds.includes(steps[index].id) ? isStepComplete(simulation, steps[index].id) : index < stepIndex

  const renderScene = ({ currentStep }) => {
    const step = stepById[currentStep.id]

    if (isCabStep(step)) {
      return (
        <div className="load-scene-wrap">
          <CabInspectionViewer
            key={step.id}
            profile={vehicleProfile}
            data={step.walkAround}
            hotspots={hotspots}
            phaseState={phaseStateFor(simulation, step.id)}
            isAdmin={showAuthoringTools}
            selectedHotspotId={focusedHotspotId}
            onEvent={handleCabEvent(step)}
            onCabStatus={walkAroundController.setCabStatus}
            onJudge={(gauge, choice) => handleGauge(step, gauge, choice)}
            onHotspotSelect={(hotspot) => handleWalkAroundHotspot(step, hotspot)}
          />
        </div>
      )
    }

    if (step?.kind === 'walk-around') {
      return (
        <WalkAroundScene
          data={step.walkAround}
          hotspots={hotspots}
          state={phaseStateFor(simulation, step.id)}
          engineStarted={simulation.engineStarted}
          activeScenarioId={scenarioIdFor(step)}
          selectedHotspotId={focusedHotspotId}
          deviceEffect={walkAroundController.activeDeviceEffect}
          defectOverlays={walkAroundDefectOverlays}
          isAdmin={showAuthoringTools}
          onHotspotSelect={(hotspot) => handleWalkAroundHotspot(step, hotspot)}
          onResetView={() => walkAroundController.setFocusedHotspotId(null)}
        />
      )
    }

    if (step?.kind === 'briefing') {
      return <BriefingScene content={step.content} />
    }

    if (step?.kind === 'checklist') {
      return <ChecklistScene content={step.content} moduleSlug={moduleSlug} title={step.title} />
    }

    if (step?.kind === 'quiz') {
      return <QuizScene content={step.content} moduleSlug={moduleSlug} title={step.title} />
    }

    const course = courseById[currentStep.id]

    if (course) {
      return (
        <div className="load-scene-wrap">
          <DrivingSimulationViewer
            profile={vehicleProfile}
            course={course}
            onEvent={handleDrivingEvent(currentStep)}
            isAdmin={showAuthoringTools}
          />
        </div>
      )
    }

    if (step?.content?.activityId === 'shutdown-sequence') {
      return (
        <ShutdownSequenceActivity
          actions={shutdownActions}
          displayOrder={shutdownDisplayOrder}
          pickedIds={shutdownPicked}
          completed={shutdownComplete}
          wrongPickId={wrongPickId}
          onPick={handleShutdownPick}
        />
      )
    }

    if (step?.content?.activityId === 'reporting') {
      return (
        <ReportingActivity
          prompts={reportPrompts}
          answers={reportAnswers}
          completed={reportingComplete}
          onAnswer={handleReportAnswer}
        />
      )
    }

    return null
  }

  const summaryStep = steps.find((step) => step.kind === 'summary')

  const renderTask = ({ currentStep }) => {
    const step = stepById[currentStep.id]
    if (step?.kind === 'briefing') {
      return (
        <>
          <BriefingTask content={step.content} module={module} objectives={moduleObjectives(steps, module)} />
          <ModuleSkills practise={moduleSkills.practise} need={moduleSkills.need} />
        </>
      )
    }
    if (step?.kind === 'walk-around') {
      return (
        <WalkAroundTask
          data={step.walkAround}
          content={step.content}
          state={phaseStateFor(simulation, step.id)}
          engineStarted={simulation.engineStarted}
          cab={walkAroundController.cabStatus}
          activeScenarioId={scenarioIdFor(step)}
          handlers={walkAroundHandlers(step)}
        />
      )
    }
    if (step?.kind === 'checklist' || step?.kind === 'quiz') {
      return <ModuleRowsTask content={step.content} kind={step.kind} />
    }
    if (courseById[currentStep.id]) return renderDrivingTask(currentStep, getStepCanProceed(currentStep.id))
    if (step?.content?.activityId === 'shutdown-sequence') return renderShutdownTask()
    if (step?.content?.activityId === 'reporting') return renderReportingTask()
    return null
  }

  const currentStepRow = stepById[steps[stepIndex]?.id]
  const moduleTitle = module.fullTitle || module.title
  const walkAroundPhaseLabel = currentStepRow?.walkAround?.phase
    ? t(PHASE_TITLE_KEYS[currentStepRow.walkAround.phase])
    : null
  // The short `module.title` avoids a doubled parenthetical for modules whose
  // `fullTitle` already carries one, e.g. "Walk-Around Check (Visual Inspection)".
  usePageTitle(walkAroundPhaseLabel ? `${module.title} (${walkAroundPhaseLabel})` : moduleTitle)
  const nextDetail =
    selectedDetail && currentStepRow?.kind === 'walk-around' ? nextWalkAroundItem(currentStepRow) : null

  return (
    <>
      {showScopeNotice && (
        <ScopeNoticeModal onDismiss={() => setShowScopeNotice(false)} />
      )}
      <SimulationPageLayout
        className="load-simulation-page"
        title={moduleTitle}
        onBack={onBack}
        headerContent={
          steps.length > 0 && (
            <ModuleHeaderContent
              steps={steps}
              currentStepIndex={stepIndex}
              maxSelectableStepIndex={maxSelectableStepIndex}
              isStepDone={isStepDone}
              onSelectStep={changeStep}
              progress={simulation.percentage}
            />
          )
        }
      >
        {loading || error || hotspotsLoading || hotspotsError ? (
          <ModuleLoadingState loading={loading || hotspotsLoading} error={error || hotspotsError} />
        ) : !steps.length ? (
          <div className="module-loading-state">
            <p>{t('module.empty')}</p>
          </div>
        ) : (
          <ModuleSimulationShell
            steps={steps}
            currentStepIndex={stepIndex}
            canProceed={getStepCanProceed(steps[stepIndex].id)}
            onBackStep={() => changeStep(Math.max(stepIndex - 1, 0))}
            onNextStep={() => changeStep(Math.min(stepIndex + 1, steps.length - 1))}
            onComplete={completeModule}
            renderScene={renderScene}
            renderTask={renderTask}
            selectedDetail={selectedDetail}
            onClearDetail={() => { setSelectedDetail(null); walkAroundController.setFocusedHotspotId(null) }}
            onNextDetail={nextDetail ? () => handleCheck(currentStepRow, nextDetail.item) : null}
            completionSummary={
              <ModuleSummary
                content={summaryStep?.content}
                steps={steps}
                gradedStepIds={gradedStepIds}
                simulation={simulation}
              />
            }
          />
        )}
      </SimulationPageLayout>
    </>
  )
}

export default GenericModulePage
