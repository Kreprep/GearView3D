// Serialization + validation for the admin course editor. Validation is
// imported from the frontend rather than duplicated, for the same reason the
// seed imports frontend/src/data: those files stay the single source of truth.
import { buildDefaultCourse, buildDefaultCourses } from '../../../frontend/src/data/courseDefaults.js'
import { moduleScenarioSteps } from '../../../frontend/src/data/moduleScenarios.js'
import { COURSE_GOAL_TYPES, validateCourse } from '../../../frontend/src/lib/courseGoals.js'

const defaultCourseIds = new Set(buildDefaultCourses().map((course) => course.id))

// Steps a module renders from hardcoded React (briefing, defect-recognition,
// shutdown-sequence, reporting, summary). A new course may not take one of
// these ids, or it would shadow the bespoke step on the module page.
export function bespokeStepIds(moduleSlug) {
  return (moduleScenarioSteps[moduleSlug] || [])
    .filter((step) => !defaultCourseIds.has(step.id))
    .map((step) => step.id)
}

// The whole editable payload. `sortOrder` is deliberately absent - reordering
// the step list is a list operation that applies immediately, not a draft.
export const courseDraftFields = ['title', 'objective', 'instructions', 'hint', 'goalType', 'data']

export function emptyCourseGeometry() {
  return {
    start: { position: [0, 0, 0], heading: 0 },
    checkpoints: [],
    decorations: [],
    pallets: [],
    dropZone: null,
    parkingBay: null,
    capacityKg: null,
    failConditions: null,
  }
}

// What a learner's module page consumes: the step's text plus the course object
// DrivingSimulationViewer takes.
export function publishedCourse(row) {
  return {
    id: row.id,
    moduleSlug: row.moduleSlug,
    sortOrder: row.sortOrder,
    title: row.title,
    objective: row.objective,
    instructions: row.instructions,
    hint: row.hint,
    goalType: row.goalType,
    course: { id: row.id, goalType: row.goalType, ...row.data },
  }
}

export function adminCourse(row) {
  return {
    ...publishedCourse(row),
    published: row.published,
    builtIn: row.builtIn,
    draft: row.draft || null,
    updatedAt: row.updatedAt,
  }
}

// The version an admin is editing: the pending draft if there is one, otherwise
// the published columns.
export function editableCourse(row) {
  if (row.draft) return { ...row.draft }
  return {
    title: row.title,
    objective: row.objective,
    instructions: row.instructions,
    hint: row.hint,
    goalType: row.goalType,
    data: row.data,
  }
}

// Returns an array of problem strings; empty means the payload can be published.
export function validateCoursePayload(payload) {
  const problems = []

  if (!payload.title?.trim()) problems.push('Course needs a title.')
  if (payload.goalType && !COURSE_GOAL_TYPES.includes(payload.goalType)) {
    problems.push(`Unknown goal type "${payload.goalType}".`)
  }

  return [...problems, ...validateCourse({ ...payload.data, goalType: payload.goalType })]
}

export function defaultCourseFor(courseId) {
  return buildDefaultCourse(courseId)
}
