// The rows the route tests act on: one account per role (plus spares to edit,
// delete and reset), the equipment row, a module with a step, checklist item
// and quiz question, a part category and hotspots. The built-in step and
// hotspot are real defaults, so "reset to default" has something to reset to.
//
// testDatabase.js is imported first on purpose: it points DATABASE_URL at the
// test database before anything below creates the Prisma client.
import { prisma, resetDatabase } from './testDatabase.js'
import { signToken } from '../../src/lib/auth.js'
import { EQUIPMENT_ID } from '../../src/lib/equipment.js'
import { buildDefaultCourses } from '../../../frontend/src/data/courseDefaults.js'
import { buildDefaultHotspots } from '../../../frontend/src/data/hotspotDefaults.js'

const builtInCourse = buildDefaultCourses().find((course) => course.kind === 'briefing')
const builtInHotspot = buildDefaultHotspots()[0]

export const ids = {
  admin: 'user-admin',
  instructor: 'user-instructor',
  trainee: 'user-trainee',
  otherAdmin: 'user-other-admin',
  otherInstructor: 'user-other-instructor',
  otherTrainee: 'user-other-trainee',
  moduleId: 1,
  moduleSlug: builtInCourse.moduleSlug,
  course: 'fixture-step',
  builtInCourse: builtInCourse.id,
  hotspot: 'fixture-hotspot',
  builtInHotspot: builtInHotspot.id,
  category: 'fixture-category',
  checklistItem: 'fixture-check',
  moduleQuestion: 'fixture-module-question',
  partsQuestion: 'fixture-parts-question',
}

const accounts = [
  [ids.admin, 'ADMIN'],
  [ids.instructor, 'INSTRUCTOR'],
  [ids.trainee, 'TRAINEE'],
  [ids.otherAdmin, 'ADMIN'],
  [ids.otherInstructor, 'INSTRUCTOR'],
  [ids.otherTrainee, 'TRAINEE'],
]

// Signed with the same secret the app verifies with, for the accounts above.
export const tokens = Object.fromEntries(
  accounts.map(([id, role]) => [id, signToken({ id, role })]),
)

export function bearer(userId) {
  return `Bearer ${tokens[userId]}`
}

export async function loadFixtures() {
  await resetDatabase()

  await prisma.user.createMany({
    data: accounts.map(([id, role]) => ({
      id,
      role,
      email: `${id}@test.local`,
      fullName: id,
      // Never logged in with: the tests carry signed tokens.
      passwordHash: 'unused',
    })),
  })

  await prisma.equipment.create({ data: { id: EQUIPMENT_ID, title: 'Forklift' } })
  await prisma.module.create({ data: { id: ids.moduleId, slug: ids.moduleSlug, title: 'Fixture module', sortOrder: 1 } })
  await prisma.course.createMany({
    data: [
      { ...builtInCourse, builtIn: true, published: true },
      {
        id: ids.course,
        moduleSlug: ids.moduleSlug,
        sortOrder: 99,
        kind: 'briefing',
        title: 'Fixture step',
        goalType: 'free',
        content: { body: 'Published' },
        draft: { title: 'Fixture step', content: { body: 'Draft' } },
        published: true,
      },
    ],
  })
  await prisma.hotspotCategory.create({ data: { id: ids.category, label: 'Fixture category', sortOrder: 1 } })
  await prisma.hotspot.createMany({
    data: [
      { ...builtInHotspot, published: true, builtIn: true },
      {
        id: ids.hotspot,
        label: 'Fixture hotspot',
        position: [0, 0.3, 0],
        inParts: true,
        draft: { label: 'Fixture hotspot, edited' },
        published: true,
      },
    ],
  })
  await prisma.checklistItem.create({
    data: { id: ids.checklistItem, moduleId: ids.moduleId, text: 'Check the forks', sortOrder: 1 },
  })
  await prisma.quizQuestion.createMany({
    data: [
      {
        id: ids.moduleQuestion,
        context: 'module',
        moduleId: ids.moduleId,
        prompt: 'Which lever lifts the forks?',
        options: ['Lift', 'Tilt'],
        answer: 'Lift',
        sortOrder: 1,
      },
      {
        id: ids.partsQuestion,
        context: 'parts',
        prompt: 'What holds the load?',
        options: ['Forks', 'Mast'],
        answer: 'Forks',
        sortOrder: 1,
      },
    ],
  })
}

export { prisma }
