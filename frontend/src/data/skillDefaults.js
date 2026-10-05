// The stock Skills Checklist: one skill per competency GearView can show
// evidence for, each mapped to the TESDA Training Regulations, Heavy Equipment
// Operation (Forklift) NC II, Rev. 01 (11/07/2019), by unit and element.
// docs/revisions/post-defense-plan.md 4.8 is the table this comes from.
//
// THIS MAPPING IS A DRAFT for adviser or panel review (question Q-C, seeded as
// a draft on 2026-10-01). The seed creates these rows create-if-missing, so a
// reviewed wording reaches a database in use through the Skills editor, and a
// changed default here reaches new databases and "Reset to default".
//
// Where 4.8 gives a skill two categories ("motor + safety") the row keeps the
// first: `category` is one value.
//
// `modules` are the module-skill links, by module slug: `teaches` feeds the
// module's "Skills you'll practise", `requires` its "Skills you need". The
// seed creates a skill's links only when it creates the skill, so a link an
// admin removed does not come back on the next boot.
//
// Evidence rules are lib/skillProgress.js's (EVIDENCE_TYPES). Step ids are
// the built-in Course rows' (data/moduleScenarios.js), and safety rule ids are
// lib/courseAlerts.js's.
//
// Pure and backend-importable, like the rest of data/: backend/prisma/seed.js
// and the admin reset route read it.

const WALK_AROUND = 'walk-around-check'
const LOAD_HANDLING = 'load-handling'
const POST_OPERATION = 'post-operation'
const PALLET_HANDLING = 'pallet-testing'

const teaches = (...slugs) => slugs.map((module) => ({ module, relation: 'teaches' }))
const requires = (...slugs) => slugs.map((module) => ({ module, relation: 'requires' }))

export const SKILL_DEFAULTS = [
  {
    id: 'identify-parts',
    title: 'Identify forklift parts and their functions',
    description: 'Name the main parts of the forklift and say what each one does.',
    category: 'knowledge',
    tesdaRef: 'CON834216 el. 1 (req. skill 1.3)',
    evidence: [
      { type: 'parts-viewed' },
      { type: 'quiz-score', context: 'parts', min: 80 },
    ],
    modules: [...requires(WALK_AROUND)],
  },
  {
    id: 'walk-around-inspection',
    title: 'Perform walk-around (BLOWAF) inspection',
    description: 'Check the forklift with the engine off before operating it, part by part.',
    category: 'procedural',
    tesdaRef: 'CON834216 el. 2–3',
    evidence: [{ type: 'step-complete', module: WALK_AROUND, stepId: 'engine-off-inspection' }],
    modules: [...teaches(WALK_AROUND)],
  },
  {
    id: 'operation-check',
    title: 'Perform operation check of gauges and safety devices',
    description: 'Start the engine and check that the gauges read normal and the safety devices work.',
    category: 'procedural',
    tesdaRef: 'CON834216 el. 4',
    evidence: [{ type: 'step-complete', module: WALK_AROUND, stepId: 'engine-on-inspection' }],
    modules: [...teaches(WALK_AROUND)],
  },
  {
    id: 'recognise-defects',
    title: 'Recognise and report defects',
    description: 'Tell a safe condition from an unsafe one and report what needs fixing.',
    category: 'knowledge',
    tesdaRef: 'CON834217 el. 1, 3',
    evidence: [
      { type: 'step-complete', module: WALK_AROUND, stepId: 'defect-recognition' },
      { type: 'step-complete', module: POST_OPERATION, stepId: 'reporting' },
    ],
    modules: [...teaches(WALK_AROUND, POST_OPERATION)],
  },
  {
    id: 'start-shutdown-sequence',
    title: 'Follow pre-start and shutdown sequence',
    description: 'Fasten the seatbelt, set the parking brake and select neutral before starting, and shut down in order.',
    category: 'procedural',
    tesdaRef: 'CON834216 el. 4–5',
    evidence: [
      { type: 'step-complete', module: POST_OPERATION, stepId: 'shutdown-sequence' },
      { type: 'clean-run', module: POST_OPERATION, stepId: 'secure-parking', rules: ['start-interlock'], severity: 'any' },
    ],
    modules: [...teaches(POST_OPERATION), ...requires(LOAD_HANDLING)],
  },
  {
    id: 'secure-parking',
    title: 'Secure parking (neutral, parking brake, forks lowered, engine off)',
    description: 'Park the forklift in neutral with the parking brake set, the forks down and the engine off.',
    category: 'procedural',
    tesdaRef: 'CON834216 el. 5.1–5.2',
    evidence: [
      { type: 'clean-run', module: POST_OPERATION, stepId: 'secure-parking', rules: ['forks-raised-parked'], severity: 'any' },
    ],
    modules: [...teaches(POST_OPERATION)],
  },
  {
    id: 'travel-safely',
    title: 'Travel the forklift safely (speed, direction of travel, turning)',
    description: 'Drive a course at a safe speed, in the right direction of travel, turning with care.',
    category: 'motor',
    tesdaRef: 'CON834218 el. 1.2–1.4',
    evidence: [
      { type: 'clean-run', module: LOAD_HANDLING, stepId: 'driving-course', rules: [], severity: 'danger' },
      { type: 'clean-run', module: LOAD_HANDLING, stepId: 'reverse-travel', rules: ['look-direction'], severity: 'any' },
      { type: 'clean-run', module: LOAD_HANDLING, stepId: 'speed-zones', rules: ['overspeed', 'sound-horn'], severity: 'any' },
    ],
    modules: [...teaches(LOAD_HANDLING), ...requires(POST_OPERATION, PALLET_HANDLING)],
  },
  {
    id: 'spatial-awareness',
    title: 'Spatial awareness and clearance judgement',
    description: 'Judge the space around the forklift, ahead, behind and where the counterweight swings.',
    category: 'perceptual',
    tesdaRef: 'CON834218 el. 1 (knowledge 1.5 "clearance and distances")',
    evidence: [
      {
        type: 'clean-run',
        module: LOAD_HANDLING,
        stepId: 'driving-course',
        rules: ['obstacle-ahead', 'obstacle-behind', 'tail-swing'],
        severity: 'danger',
      },
      { type: 'clean-run', module: LOAD_HANDLING, stepId: 'reverse-travel', rules: ['obstacle-behind'], severity: 'danger' },
    ],
    modules: [...teaches(LOAD_HANDLING, POST_OPERATION)],
  },
  {
    id: 'load-chart',
    title: 'Interpret the load chart and capacity',
    description: 'Read the capacity plate and tell whether a load is within it at its load centre.',
    category: 'knowledge',
    tesdaRef: 'CON834218 el. 3',
    evidence: [
      { type: 'step-complete', module: PALLET_HANDLING, stepId: 'load-limits' },
      { type: 'step-complete', module: PALLET_HANDLING, stepId: 'load-centre' },
      { type: 'quiz-score', module: PALLET_HANDLING, min: 80 },
    ],
    modules: [...teaches(PALLET_HANDLING)],
  },
  {
    id: 'engage-lift-load',
    title: 'Engage and lift a load securely',
    description: 'Drive the forks fully into a pallet and lift it without it slipping.',
    category: 'motor',
    tesdaRef: 'CON834218 el. 4',
    evidence: [
      { type: 'clean-run', module: LOAD_HANDLING, stepId: 'pallet-pickup', rules: ['forks-not-inserted'], severity: 'any' },
    ],
    modules: [...teaches(LOAD_HANDLING), ...requires(PALLET_HANDLING)],
  },
  {
    id: 'carry-stack-load',
    title: 'Carry and stack a load at height',
    description: 'Carry a load round turns to a rack, set it on a shelf and take one down, without tilting it forward or risking a tip-over.',
    category: 'motor',
    tesdaRef: 'CON834218 el. 4.2–4.4',
    evidence: [
      {
        type: 'clean-run',
        module: PALLET_HANDLING,
        stepId: 'rack-storage',
        rules: ['tilt-forward-elevated', 'tip-risk'],
        severity: 'any',
      },
      {
        type: 'clean-run',
        module: PALLET_HANDLING,
        stepId: 'stability-turns',
        rules: ['tip-risk', 'load-shifting', 'turn-speed'],
        severity: 'any',
      },
      {
        type: 'clean-run',
        module: PALLET_HANDLING,
        stepId: 'rack-retrieval',
        rules: ['tilt-forward-elevated', 'lifting-while-moving', 'forks-high-travel'],
        severity: 'any',
      },
    ],
    modules: [...teaches(PALLET_HANDLING)],
  },
  {
    id: 'respond-unexpected',
    title: 'Respond to unexpected situations',
    description: 'When a warning comes up, correct it before it becomes dangerous, and finish the task.',
    category: 'safety',
    tesdaRef: 'CON834218 el. 1.4, 4.6',
    evidence: [{ type: 'caution-recovered' }],
    modules: [...teaches(LOAD_HANDLING, PALLET_HANDLING)],
  },
]

// The row the seed creates and "Reset to default" restores, without links.
export function skillRowDefaults(skill, index) {
  return {
    id: skill.id,
    title: skill.title,
    description: skill.description,
    category: skill.category,
    tesdaRef: skill.tesdaRef,
    evidence: skill.evidence,
    sortOrder: index + 1,
  }
}

export function defaultSkillFor(id) {
  const index = SKILL_DEFAULTS.findIndex((skill) => skill.id === id)
  return index === -1 ? null : skillRowDefaults(SKILL_DEFAULTS[index], index)
}

// Whether the mapping above has been reviewed (question Q-C). While it is a
// draft, the Skills Checklist says so under the list.
export const SKILL_MAPPING_REVIEWED = false
