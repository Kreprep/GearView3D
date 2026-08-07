// A module's step list is half hardcoded and half data.
//
// Bespoke steps (briefing, shutdown-sequence, reporting, summary, ...) are
// rendered by hardcoded React in the page component, so they stay in
// data/moduleScenarios.js and cannot be added or removed by an admin. Driving
// steps come from the `Course` table and are fully editable. This module merges
// the two into the ordered list ModuleSimulationShell renders.
import { buildDefaultCourses } from '../data/courseDefaults'
import { moduleScenarioSteps } from '../data/moduleScenarios'

const defaultCourseIds = new Set(buildDefaultCourses().map((course) => course.id))

// The bespoke step each module's driving courses are inserted after. Every
// module currently opens with a briefing and ends with a summary, so courses
// sit in between.
const coursesAfterStepId = {
  'load-handling': 'briefing',
  'post-operation': 'briefing',
  'pallet-testing': 'briefing',
}

export function bespokeSteps(moduleSlug) {
  return (moduleScenarioSteps[moduleSlug] || []).filter((step) => !defaultCourseIds.has(step.id))
}

function courseToStep(course) {
  return {
    id: course.id,
    title: course.title,
    objective: course.objective,
    instructions: course.instructions,
    hint: course.hint,
  }
}

export function mergeModuleSteps(moduleSlug, courses = []) {
  const anchor = coursesAfterStepId[moduleSlug]
  const steps = []

  for (const step of bespokeSteps(moduleSlug)) {
    steps.push(step)
    if (step.id === anchor) {
      steps.push(...courses.map(courseToStep))
    }
  }

  return steps
}
