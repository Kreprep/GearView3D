// Default rows for the `Course` table, composed from the two files that used
// to own driving-course content: `moduleScenarios.js` (step title/objective/
// instructions/hint) and `drivingCourse.js` (geometry). Those files stay the
// single source of defaults - the backend seeds from here, and the admin
// dashboard's "Reset to default" reads the same builder.
//
// Only steps that have a driving course become rows. Bespoke steps (briefing,
// defect-recognition, shutdown-sequence, reporting, summary) stay code-owned.
import { courseGoalType } from '../lib/courseGoals.js'
import { drivingCourses } from './drivingCourse.js'
import { moduleScenarioSteps } from './moduleScenarios.js'

// Walk-around-check is deliberately absent: it has no driving courses.
export const courseModuleSlugs = ['load-handling', 'post-operation', 'pallet-testing']

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
  }))

  return {
    start: course.start || { position: [0, 0, 0], heading: 0 },
    checkpoints: course.checkpoints || [],
    decorations,
    pallets,
    dropZone: course.dropZone || null,
    parkingBay: course.parkingBay || null,
    capacityKg: typeof course.capacityKg === 'number' ? course.capacityKg : null,
    failConditions: course.failConditions || null,
  }
}

export function buildDefaultCourses() {
  const rows = []

  for (const moduleSlug of courseModuleSlugs) {
    let sortOrder = 0

    for (const step of moduleScenarioSteps[moduleSlug] || []) {
      const course = drivingCourses[step.id]
      if (!course) continue

      sortOrder += 1
      rows.push({
        id: step.id,
        moduleSlug,
        sortOrder,
        title: step.title,
        objective: step.objective || '',
        instructions: step.instructions || '',
        hint: step.hint || '',
        goalType: courseGoalType(course),
        data: normalizeCourseGeometry(course),
      })
    }
  }

  return rows
}

export function buildDefaultCourse(courseId) {
  return buildDefaultCourses().find((course) => course.id === courseId) || null
}
