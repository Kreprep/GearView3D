// Default rows for the `Course` table - every step of Modules 2-4, not just the
// driving ones. Composed from the two files that used to own module content:
// `moduleScenarios.js` (step order + title/objective/instructions/hint) and
// `drivingCourse.js` (geometry), plus the lesson text in `trainingModules.js`.
// Those files stay the single source of defaults: the backend seeds from here,
// and the dashboard's "Reset to default" reads the same builder.
//
// A step's `kind` picks how the module page renders it - see the Course model
// in backend/prisma/schema.prisma.
import { courseGoalType } from '../lib/courseGoals.js'
import { drivingCourses } from './drivingCourse.js'
import {
  defectRecognitionScenarios,
  engineOffInspectionChecks,
  engineOnControlChecks,
  engineOnGaugeChecks,
  safetyDeviceTests,
} from './inspectionScenarios.js'
import { moduleScenarioSteps } from './moduleScenarios.js'
import {
  postOperationReportPrompts,
  shutdownDisplayOrder,
  shutdownSequenceActions,
} from './postOperationScenarios.js'
import { equipmentUsageModules } from './trainingModules.js'

export const courseModuleSlugs = ['walk-around-check', 'load-handling', 'post-operation', 'pallet-testing']

export const COURSE_KINDS = ['briefing', 'driving', 'walk-around', 'activity', 'checklist', 'quiz', 'summary']

// The three phases a `walk-around` step can run, each its own step row so a
// module can have any subset of them:
//   engine-off  - click through the inspection checks, then start the engine
//   engine-on   - judge the dashboard gauges and test the devices/controls
//   defect-test - decide whether the equipment in each visual state is usable
export const WALK_AROUND_PHASES = ['engine-off', 'engine-on', 'defect-test']

// `checklist` and `quiz` steps render the module's ChecklistItem / QuizQuestion
// rows, which are edited in their own dashboard tabs rather than on the step.
// The step only carries its intro copy.
export const MODULE_ROW_KINDS = ['checklist', 'quiz']

// Extra stat rows a summary step can show under its per-step grid. The keys are
// read straight off the stored simulation state, so only counters the module
// pages actually record are offered.
export const SUMMARY_COUNTER_LABELS = {
  failedAttempts: 'Failed Attempts',
  shutdownMistakes: 'Ordering Mistakes',
}

// Where Submit sends the learner once a module is complete, stored on the
// summary step as a key rather than a path, so a route that moves does not
// strand saved content. These four resolve against whichever equipment the
// module belongs to (lib/moduleContent.js); the admin picker adds one
// `module:<slug>` entry per module the equipment actually has, which is why
// there is no fixed list of Forklift modules here any more.
export const NEXT_ROUTE_TARGETS = [
  ['modules', 'Module list'],
  ['hub', 'Training hub'],
  ['parts', 'Parts Identification'],
  ['assessment', 'Final Assessment'],
]

// Steps whose UI is hardcoded React keyed by id. Admins can reorder or delete
// these rows but cannot create new ones - there is no code behind a new id.
const ACTIVITY_STEP_IDS = ['shutdown-sequence', 'reporting']

// The stored geometry shape is flatter than the hand-written one:
//   - `obstacles` folds into `decorations` (the viewer already treats cones in
//     both as live colliders, and `obstacles` only ever held cones)
//   - the singular `pallet` folds into `pallets`
// so the editor has exactly one list of props and one list of pallets to edit.
export function normalizeCourseGeometry(course = {}) {
  const decorations = [...(course.obstacles || []), ...(course.decorations || [])].map((item) => ({
    type: item.type,
    position: [item.position[0], 0, item.position[2]],
    ...(item.rotation !== undefined ? { rotation: item.rotation } : {}),
    ...(item.length !== undefined ? { length: item.length } : {}),
  }))

  const pallets = (course.pallets || (course.pallet ? [course.pallet] : [])).map((pallet) => ({
    id: pallet.id,
    position: [pallet.position[0], 0, pallet.position[2]],
    rotation: pallet.rotation || 0,
    ...(pallet.weightKg !== undefined ? { weightKg: pallet.weightKg } : {}),
    ...(pallet.targetRack ? { targetRack: pallet.targetRack, targetLevel: pallet.targetLevel } : {}),
  }))

  const racks = (course.racks || []).map((rack) => ({
    id: rack.id,
    position: [rack.position[0], 0, rack.position[2]],
    rotation: rack.rotation || 0,
  }))

  return {
    start: course.start || { position: [0, 0, 0], heading: 0 },
    checkpoints: course.checkpoints || [],
    decorations,
    pallets,
    racks,
    dropZone: course.dropZone || null,
    parkingBay: course.parkingBay || null,
    capacityKg: typeof course.capacityKg === 'number' ? course.capacityKg : null,
    failConditions: course.failConditions || null,
    completionCode: course.completionCode || null,
  }
}

// The editable payload of a `walk-around` step. Only the lists its phase uses
// are filled in, but all of them exist so an admin switching phase does not
// hit undefined.
export function emptyWalkAroundData(phase = 'engine-off') {
  return {
    phase,
    requireEngineStart: phase === 'engine-off',
    checks: [],
    gauges: [],
    devices: [],
    scenarios: [],
  }
}

export function emptyCourseGeometry() {
  return {
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    decorations: [],
    pallets: [],
    racks: [],
    dropZone: null,
    parkingBay: null,
    capacityKg: null,
    failConditions: null,
    completionCode: null,
  }
}

export function emptyCourseContent(kind) {
  switch (kind) {
    case 'briefing':
      return {
        image: '',
        sceneBody: '',
        body: '',
        showSyllabus: true,
        objectives: [],
        syllabus: emptySyllabus(),
      }
    case 'summary':
      return {
        body: '',
        completeMessage: 'All requirements are complete. Submit the module to record completion feedback.',
        incompleteMessage: 'Complete every graded step to finish this module.',
        counters: [],
        nextRoute: 'modules',
      }
    case 'activity':
      return { activityId: '' }
    case 'walk-around':
      return { body: '' }
    case 'checklist':
      return { body: '', completeMessage: 'Checklist complete.' }
    case 'quiz':
      return { body: '', passMessage: 'Quiz submitted.' }
    default:
      return null
  }
}

// The cards, answers and feedback of the two built-in activities. The screens
// stay code (an admin cannot invent a new activityId) but everything they read
// is content, so wording and even the correct order are editable.
function activityContent(stepId) {
  if (stepId === 'shutdown-sequence') {
    return {
      activityId: stepId,
      // `order` is the sequence the learner must pick; `displayOrder` is the
      // fixed scrambled order the cards are shown in, so retries look the same.
      actions: shutdownSequenceActions.map((action) => ({ ...action })),
      displayOrder: [...shutdownDisplayOrder],
    }
  }

  if (stepId === 'reporting') {
    return {
      activityId: stepId,
      prompts: postOperationReportPrompts.map((prompt) => ({ ...prompt })),
    }
  }

  return { activityId: stepId }
}

// The centre-panel content of each module's briefing. Module 2 shows the
// controls reference image; the other two showed a hardcoded text panel, kept
// here verbatim as markdown so nothing is lost when it becomes editable.
const BRIEFING_SCENE = {
  'walk-around-check': {
    image: '',
    sceneBody: [
      '### BLOWBAGETS Pre-Operation Check',
      '',
      'BLOWBAGETS is the standard walk-around mnemonic drivers use before operating any vehicle or equipment. This module organizes the forklift inspection the same way - one letter, one system to check:',
      '',
      '- **B - Battery** - tight connections, clean terminals, no corrosion.',
      '- **L - Lights** - headlights, taillights, brake lights, and turn signals respond.',
      '- **O - Oil** - engine oil level is sufficient and no leaks are visible.',
      '- **W - Water** - coolant and any hydraulic fluid reservoirs are full, with no leaks.',
      '- **B - Brake** - brake fluid is adequate and the service/parking brake respond.',
      '- **A - Air** - tire pressure looks correct and tires show no damage.',
      '- **G - Gas** - enough LPG fuel remains for the shift.',
      '- **E - Engine** - idles smoothly with no unusual sounds.',
      '- **T - Tires** - tread shows no excessive wear, cuts, or bulges.',
      '- **S - Self** - you are rested, alert, and fit to operate.',
      '',
      'The next two steps split these the same way a real inspection does: **Engine-Off** covers what you can see and touch with the engine stopped (Battery, Oil, Water, Air, Gas, Tires), and **Engine-On** covers what you can only confirm once it is running (Lights, Brake, Engine, plus a Self check before you start).',
    ].join('\n'),
  },
  'load-handling': {
    image: '/images/controls-wasd.png',
    sceneBody: '',
  },
  'post-operation': {
    image: '',
    sceneBody: [
      '### Secure Parking Discipline',
      '',
      '- Park inside the painted bay, clear of traffic lanes and cones.',
      '- Lower the forks flat, set controls to neutral, and engage the parking brake.',
      '- Switch off the equipment and report anything unsafe found during the shift.',
      '',
      'The next step is a driving exercise: the parking is only accepted when the forklift is inside the lines, straight, stopped, forks lowered, and the engine is off. Cones along the route are live - hitting one fails the attempt.',
    ].join('\n'),
  },
  'pallet-testing': {
    image: '',
    sceneBody: [
      '### Fail Conditions',
      '',
      '- **Overload tip-over** - lifting a pallet heavier than the rated capacity shifts the center of gravity past the front axle and pitches the forklift forward.',
      '- **Cone strike** - touching any traffic cone ends the attempt, the same as striking a pedestrian lane marker in a practical evaluation.',
      '- **Load thrown off** - braking hard above walking speed throws the pallet off the forks. Slow down early and brake gently while carrying.',
      '',
      'Rated capacity in this assessment: **1,000 kg**. After a fail, use **Reset Attempt** and try again - failed attempts are counted but never block completion.',
    ].join('\n'),
  },
}

// Extra stat rows the summary shows under the per-step grid. The keys are read
// straight off the stored simulation state.
const SUMMARY_COUNTERS = {
  'load-handling': [],
  'post-operation': ['failedAttempts', 'shutdownMistakes'],
  'pallet-testing': ['failedAttempts'],
}

// The module page navigates here after Submit. `pallet-testing` is the last
// module, so it returns to the Equipment Usage overview.
// Keys of the equipment-relative scheme in lib/moduleContent.js, not paths -
// `module:<slug>` for a specific module, `modules` for that equipment's list.
const SUMMARY_NEXT_ROUTE = {
  'load-handling': 'module:post-operation',
  'post-operation': 'module:pallet-testing',
  'pallet-testing': 'modules',
}

export function emptySyllabus() {
  return { location: '', unitCode: '', element: '', pageReferences: '' }
}

const SUMMARY_INCOMPLETE = {
  'load-handling': 'Complete all guided driving tasks to finish this module.',
  'post-operation': 'Complete every parking drive, the shutdown ordering, and the reporting decisions to finish this module.',
  'pallet-testing': 'Complete every assessment exercise to finish this module.',
}

function lessonModule(moduleSlug) {
  return equipmentUsageModules.find((entry) => entry.slug === moduleSlug)
}

function lessonMarkdown(moduleSlug) {
  return (lessonModule(moduleSlug)?.lessonContent || []).join('\n\n')
}

// Which walk-around phase each of Forklift's original step ids became.
const WALK_AROUND_STEP_PHASES = {
  'engine-off-inspection': 'engine-off',
  'engine-on-inspection': 'engine-on',
  'defect-recognition': 'defect-test',
}

// The walk-around task panel's intro text, by phase - ties the interactive
// checks/gauges/devices/scenarios back to the BLOWBAGETS letters introduced on
// the briefing's centre panel.
const WALK_AROUND_BODY = {
  'engine-off': [
    '### Engine-Off Inspection - BLOWBAGETS (Before Starting)',
    '',
    'With the engine off, walk around the forklift and check each area below - by clicking its inspection card or its marker on the 3D model.',
    '',
    '- **B - Battery**: LPG tank, mounting bracket, and battery area - tight connections, no corrosion or leaks.',
    '- **O - Oil**: hydraulic hoses, lift chain, and the ground beneath the forklift - no oil or hydraulic fluid leaks.',
    '- **W - Water**: hydraulic fluid is at a safe level, with no visible leaks.',
    '- **A - Air**: tire pressure looks correct for a pneumatic tire.',
    '- **G - Gas**: the LPG tank is mounted securely with no leak at the fittings - the gauge reading comes later, once the engine is on.',
    '- **T - Tires**: tread and sidewalls show no cuts, bulges, or excessive wear.',
    '- **S - Self**: before you turn the key, confirm you are rested, alert, and fit to operate.',
    '',
    'Forks, mast, counterweight, seat belt, and the overhead guard round out the walk-around even though they sit outside the BLOWBAGETS letters. Any damaged or unsafe item found here should stop operation before the engine is started.',
  ].join('\n'),
  'engine-on': [
    '### Engine-On Inspection - BLOWBAGETS (After Starting)',
    '',
    'With the engine running, confirm the dashboard readings and test each control below.',
    '',
    '- **B - Battery**: the battery charge indicator should not stay lit.',
    '- **L - Lights**: headlights, tail lights, turn signals, and the warning beacon all respond.',
    '- **B - Brake**: the service brake and parking brake respond correctly.',
    '- **G - Gas**: the LPG level gauge shows enough fuel for the shift.',
    '- **E - Engine**: listen for unusual sounds and confirm a smooth idle - the temperature gauge should read in the normal range, not the red zone.',
    '',
    'Steering, the horn, the backup alarm, and the lift/tilt and travel controls complete the check. Not every gauge reads normal in this exercise - a warning light that stays lit or a needle in the red zone must be marked Abnormal and reported.',
  ].join('\n'),
  'defect-test': [
    '### Defect Recognition Test',
    '',
    'Each scenario below shows the forklift in a different visual state. Decide whether it is safe to operate using the same BLOWBAGETS judgment from the previous two steps - a defect in any BLOWBAGETS system is reason enough to answer No.',
    '',
    '- A visible fluid leak points to a possible **Oil** or **Water** problem.',
    '- A flat or worn tire points to an **Air** or **Tires** problem.',
    '- No visible defect at all means the forklift may proceed to operation.',
    '',
    'Choose Yes only when nothing in the scene indicates an unsafe condition.',
  ].join('\n'),
}

const SUMMARY_BODY = {
  'walk-around-check': [
    '### Walk-Around Check Complete',
    '',
    "This module walked through the forklift's pre-operation inspection using BLOWBAGETS: **B**attery, **L**ights, **O**il, **W**ater, **B**rake, **A**ir, **G**as, **E**ngine, **T**ires, and **S**elf. Engine-off checks covered what can be seen and touched before starting; engine-on checks confirmed the gauges and controls once running; the defect recognition test practiced deciding when a visible condition means the forklift should not be used.",
    '',
    'Carry this same habit into every shift - a consistent walk-around before operation catches problems before they become incidents.',
  ].join('\n'),
}

function stepKind(stepId) {
  if (drivingCourses[stepId]) return 'driving'
  if (WALK_AROUND_STEP_PHASES[stepId]) return 'walk-around'
  if (stepId === 'briefing') return 'briefing'
  if (stepId === 'summary') return 'summary'
  return 'activity'
}

// Forklift's inspection content, moved out of data/inspectionScenarios.js and
// onto the step row that renders it. `hotspotId` defaults to the check's own
// id, which is how the 3D markers were matched before.
function walkAroundData(stepId) {
  const phase = WALK_AROUND_STEP_PHASES[stepId]

  if (phase === 'engine-off') {
    return {
      ...emptyWalkAroundData(phase),
      requireEngineStart: true,
      checks: engineOffInspectionChecks.map((check) => ({ ...check })),
    }
  }

  if (phase === 'engine-on') {
    return {
      ...emptyWalkAroundData(phase),
      gauges: engineOnGaugeChecks.map((gauge) => ({ ...gauge })),
      devices: [
        ...safetyDeviceTests.map((device) => ({ ...device, group: 'safety' })),
        ...engineOnControlChecks.map((control) => ({ ...control, group: 'controls' })),
      ],
    }
  }

  return {
    ...emptyWalkAroundData(phase),
    scenarios: defectRecognitionScenarios.map((scenario) => ({ ...scenario })),
  }
}

// Briefing and summary ids are namespaced by module because every module has
// one and `id` is the primary key. Driving and activity ids are already unique
// and stay as-is, since learner progress is keyed on them.
function stepRowId(moduleSlug, stepId, kind) {
  return kind === 'briefing' || kind === 'summary' ? `${moduleSlug}-${stepId}` : stepId
}

function stepContent(moduleSlug, stepId, kind) {
  if (kind === 'briefing') {
    const module = lessonModule(moduleSlug)

    // `objectives` and `syllabus` describe the whole module, not this one step,
    // but they live on the briefing row because every module has exactly one
    // briefing and it is the step that shows them. The pages read them off the
    // module's briefing whichever step the learner is on.
    return {
      ...BRIEFING_SCENE[moduleSlug],
      body: lessonMarkdown(moduleSlug),
      showSyllabus: true,
      objectives: module?.learningObjectives || [],
      syllabus: {
        location: module?.syllabusLocation || '',
        unitCode: module?.unitCode || '',
        element: module?.element || '',
        pageReferences: module?.pageReferences || '',
      },
    }
  }

  if (kind === 'summary') {
    return {
      body: SUMMARY_BODY[moduleSlug] || '',
      completeMessage: 'All requirements are complete. Submit the module to record completion feedback.',
      incompleteMessage: SUMMARY_INCOMPLETE[moduleSlug] || 'Complete every graded step to finish this module.',
      counters: SUMMARY_COUNTERS[moduleSlug] || [],
      nextRoute: SUMMARY_NEXT_ROUTE[moduleSlug] || 'modules',
    }
  }

  if (kind === 'activity') {
    return activityContent(stepId)
  }

  if (kind === 'walk-around') {
    return { body: WALK_AROUND_BODY[WALK_AROUND_STEP_PHASES[stepId]] || '' }
  }

  return null
}

export function buildDefaultCourses() {
  const rows = []

  for (const moduleSlug of courseModuleSlugs) {
    let sortOrder = 0

    for (const step of moduleScenarioSteps[moduleSlug] || []) {
      const kind = stepKind(step.id)

      // An activity id with no hardcoded component behind it would render as a
      // blank step, so skip anything unexpected rather than seeding it.
      if (kind === 'activity' && !ACTIVITY_STEP_IDS.includes(step.id)) continue

      sortOrder += 1
      rows.push({
        id: stepRowId(moduleSlug, step.id, kind),
        moduleSlug,
        sortOrder,
        kind,
        title: step.title,
        objective: step.objective || '',
        instructions: step.instructions || '',
        hint: step.hint || '',
        goalType: kind === 'driving' ? courseGoalType(drivingCourses[step.id]) : 'free',
        data:
          kind === 'driving'
            ? normalizeCourseGeometry(drivingCourses[step.id])
            : kind === 'walk-around'
              ? walkAroundData(step.id)
              : null,
        content: stepContent(moduleSlug, step.id, kind),
      })
    }
  }

  return rows
}

export function buildDefaultCourse(courseId) {
  return buildDefaultCourses().find((course) => course.id === courseId) || null
}
