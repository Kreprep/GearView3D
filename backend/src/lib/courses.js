// Serialization + validation for the admin course editor. Validation is
// imported from the frontend rather than duplicated, for the same reason the
// seed imports frontend/src/data: those files stay the single source of truth.
import {
  buildDefaultCourse,
  COURSE_KINDS,
  emptyCourseContent,
  emptyCourseGeometry,
  emptyWalkAroundData,
  WALK_AROUND_PHASES,
} from '../../../frontend/src/data/courseDefaults.js'
import { COURSE_GOAL_TYPES, validateCourse } from '../../../frontend/src/lib/courseGoals.js'
import { engineOnProblems } from '../../../frontend/src/lib/walkAroundStep.js'

export { COURSE_KINDS, emptyCourseContent, emptyCourseGeometry, emptyWalkAroundData }

// The whole editable payload. `sortOrder` is deliberately absent - reordering
// the step list is a list operation that applies immediately, not a draft.
export const courseDraftFields = ['title', 'objective', 'instructions', 'hint', 'goalType', 'data', 'content']

// Kinds an admin may create. `activity` is excluded: those steps are React
// screens keyed by a fixed activityId, so a new one would render blank. Their
// cards and answers are still editable as content.
export const CREATABLE_KINDS = ['briefing', 'driving', 'walk-around', 'checklist', 'quiz', 'summary']

// What a learner's module page consumes: the step's text plus whichever payload
// its kind needs. `course` is what DrivingSimulationViewer takes, and is null
// for every non-driving step.
export function publishedCourse(row) {
  return {
    id: row.id,
    moduleSlug: row.moduleSlug,
    sortOrder: row.sortOrder,
    kind: row.kind,
    title: row.title,
    objective: row.objective,
    instructions: row.instructions,
    hint: row.hint,
    goalType: row.goalType,
    content: row.content || null,
    course: row.kind === 'driving' && row.data ? { id: row.id, goalType: row.goalType, ...row.data } : null,
    // Walk-around steps carry their inspection payload the way driving steps
    // carry geometry; every other kind sends null.
    walkAround: row.kind === 'walk-around' ? row.data || emptyWalkAroundData() : null,
  }
}

export function adminCourse(row) {
  return {
    ...publishedCourse(row),
    data: row.data || null,
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
    content: row.content,
  }
}

// Returns an array of problem strings; empty means the payload can be
// published. Only driving steps carry geometry, so only they are goal-checked.
export function validateCoursePayload(kind, payload) {
  const problems = []

  if (!payload.title?.trim()) problems.push('Step needs a title.')

  if (kind === 'walk-around') {
    const data = payload.data || {}
    if (!WALK_AROUND_PHASES.includes(data.phase)) {
      problems.push(`Unknown walk-around phase "${data.phase}".`)
      return problems
    }
    if (data.phase === 'engine-off' && !(data.checks || []).length) {
      problems.push('An engine-off step needs at least one inspection check.')
    }
    if (data.phase === 'engine-on') {
      if (!(data.gauges || []).length && !(data.devices || []).length) {
        problems.push('An engine-on step needs at least one gauge or device test.')
      }
      problems.push(...engineOnProblems(data))
    }
    if (data.phase === 'defect-test' && !(data.scenarios || []).length) {
      problems.push('A defect test step needs at least one scenario.')
    }
    return problems
  }

  if (kind !== 'driving') return problems

  if (payload.goalType && !COURSE_GOAL_TYPES.includes(payload.goalType)) {
    problems.push(`Unknown goal type "${payload.goalType}".`)
  }

  return [...problems, ...validateCourse({ ...payload.data, goalType: payload.goalType })]
}

export function defaultCourseFor(courseId) {
  return buildDefaultCourse(courseId)
}
