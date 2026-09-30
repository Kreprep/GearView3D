// Seeds the database from the frontend's data files so the content only lives
// in one place. Existing rows are left untouched (create-if-missing), so
// re-running the seed never overwrites admin edits made through the dashboard.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import {
  moduleChecklists,
  trainingModules,
} from '../../frontend/src/data/trainingModules.js'
import { buildDefaultHotspotCategories } from '../../frontend/src/data/partsData.js'
// Quiz answers live in their own files so the frontend bundle never imports
// them; the seed is the only consumer.
import { buildDefaultPartsQuizQuestions } from '../../frontend/src/data/partsQuizzes.js'
import { moduleQuizQuestions } from '../../frontend/src/data/moduleQuizzes.js'
import { buildDefaultCourses } from '../../frontend/src/data/courseDefaults.js'
import { withMissingAlertDefaults } from '../../frontend/src/lib/courseAlerts.js'
import { EQUIPMENT_DEFAULTS } from '../../frontend/src/data/equipment.js'
import { buildDefaultHotspots } from '../../frontend/src/data/hotspotDefaults.js'

const prisma = new PrismaClient()

const demoUsers = [
  {
    email: 'admin@mail.com',
    password: 'admin123',
    fullName: 'GearView3D Admin',
    role: 'ADMIN',
  },
  {
    email: 'instructor@mail.com',
    password: 'instructor123',
    fullName: 'Sample Instructor',
    role: 'INSTRUCTOR',
  },
  {
    email: 'trainee@mail.com',
    password: 'trainee123',
    fullName: 'Sample Trainee',
    role: 'TRAINEE',
  },
]

async function seedUsers() {
  // SEED_DEMO_USERS gates the known-password demo accounts. Local dev keeps
  // them on by default (.env.example); production (docker-compose.yml) sets
  // it to false so admin@mail.com/admin123 doesn't come back on every boot.
  // Create-if-missing: an existing account, its role included, is left as is.
  if (process.env.SEED_DEMO_USERS === 'false') {
    console.log('SEED_DEMO_USERS=false - skipping demo user seed')
    return
  }
  console.log('SEED_DEMO_USERS!=false - seeding demo users')

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 10),
        fullName: user.fullName,
        role: user.role,
      },
    })
  }
}

// The one Equipment row - the forklift's title, hub artwork and overrides.
async function seedEquipment() {
  await prisma.equipment.upsert({
    where: { id: EQUIPMENT_DEFAULTS.id },
    update: {},
    create: { ...EQUIPMENT_DEFAULTS },
  })
}

const SUPERSEDED_MODULE_IMAGE_URLS = new Set([
  '/images/modules/post-operation.png',
  '/images/modules/pallet-testing.png',
])

async function seedModules() {
  for (const [index, module] of trainingModules.entries()) {
    const existing = await prisma.module.findUnique({ where: { id: module.id } })

    if (!existing) {
      await prisma.module.create({
        data: {
          id: module.id,
          slug: module.slug,
          title: module.title,
          fullTitle: module.fullTitle || module.title,
          subtitle: module.subtitle || '',
          description: module.description || '',
          imageUrl: module.imageUrl || '',
          sortOrder: index + 1,
        },
      })
      continue
    }

    // fullTitle is newer than the rows themselves, so a row that predates it
    // gets the default filled in. Anything an admin has typed is left alone,
    // because only an empty value is replaced.
    if (!existing.fullTitle) {
      await prisma.module.update({
        where: { id: module.id },
        data: { fullTitle: module.fullTitle || module.title },
      })
    }

    // Cache-busting an image every visitor already cached wrongly. Modules 3
    // and 4 named artwork that was not in the repo until 2026-09-01, and until
    // then nginx answered those URLs with the SPA shell as a 200 text/html
    // (see the =404 rule in frontend/nginx.conf, which stops it recurring).
    // Browsers cached that HTML under the image URL, so shipping the real PNG
    // does not reach anyone who visited first - no server-side change evicts
    // a cached entry, only a URL they have never requested. The stock URLs now
    // carry ?v=2, and a row still holding the exact superseded value is moved
    // to it; a row an admin has since edited does not match, so it is untouched.
    if (SUPERSEDED_MODULE_IMAGE_URLS.has(existing.imageUrl) && module.imageUrl) {
      await prisma.module.update({
        where: { id: module.id },
        data: { imageUrl: module.imageUrl },
      })
    }
  }
}

// The stock markers - the parts, the inspection hotspots, and the detail
// cards for both, which are one row each.
async function seedHotspots() {
  for (const hotspot of buildDefaultHotspots()) {
    await prisma.hotspot.upsert({
      where: { id: hotspot.id },
      update: {},
      create: { ...hotspot, published: true, builtIn: true },
    })
  }
}

async function seedHotspotCategories() {
  for (const category of buildDefaultHotspotCategories()) {
    await prisma.hotspotCategory.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    })
  }
}

// The stock parts quiz.
async function seedPartsQuizQuestions() {
  for (const question of buildDefaultPartsQuizQuestions()) {
    await prisma.quizQuestion.upsert({
      where: { id: question.id },
      update: {},
      create: question,
    })
  }
}

async function seedChecklists() {
  for (const [moduleSlug, items] of Object.entries(moduleChecklists)) {
    const module = trainingModules.find((entry) => entry.slug === moduleSlug)
    if (!module) continue

    for (const [index, text] of items.entries()) {
      await prisma.checklistItem.upsert({
        where: { id: `${moduleSlug}-check-${index + 1}` },
        update: {},
        create: {
          id: `${moduleSlug}-check-${index + 1}`,
          moduleId: module.id,
          text,
          sortOrder: index + 1,
        },
      })
    }
  }
}

async function seedQuizQuestions() {
  for (const [moduleSlug, questions] of Object.entries(moduleQuizQuestions)) {
    const module = trainingModules.find((entry) => entry.slug === moduleSlug)
    if (!module) continue

    for (const [index, question] of questions.entries()) {
      await prisma.quizQuestion.upsert({
        where: { id: question.id },
        update: {},
        create: {
          id: question.id,
          context: 'module',
          moduleId: module.id,
          prompt: question.prompt,
          answer: question.answer,
          sortOrder: index + 1,
          options: question.options,
        },
      })
    }
  }
}

async function seedCourses() {
  for (const course of buildDefaultCourses()) {
    const existing = await prisma.course.findUnique({ where: { id: course.id } })

    if (!existing) {
      await prisma.course.create({ data: { ...course, builtIn: true, published: true } })
      continue
    }

    // Still create-if-missing for everything the admin can edit, with one
    // exception: a key added to the defaults *after* a row was seeded is
    // backfilled, because the row has no value for it at all. Keys the row
    // already has - including ones an admin deliberately blanked - always win.
    // That covers every content key, and in a driving step's data only the
    // safety signs' settings (a stock speed limit): the geometry is never
    // touched.
    if (!existing.builtIn) continue
    const update = {}

    if (course.content) {
      const current = existing.content || {}
      const missing = Object.keys(course.content).filter((key) => !(key in current))
      if (missing.length) update.content = { ...course.content, ...current }
    }

    if (course.kind === 'driving' && course.data) {
      const data = withMissingAlertDefaults(existing.data, course.data)
      if (data !== existing.data) update.data = data
      // A pending draft is a whole payload: publishing it must not drop what
      // the published row was just given.
      const draftData = withMissingAlertDefaults(existing.draft?.data, course.data)
      if (draftData !== existing.draft?.data) update.draft = { ...existing.draft, data: draftData }
    }

    if (Object.keys(update).length) await prisma.course.update({ where: { id: course.id }, data: update })
  }
}

async function main() {
  await seedUsers()
  await seedEquipment()
  await seedModules()
  await seedHotspots()
  await seedHotspotCategories()
  await seedPartsQuizQuestions()
  await seedChecklists()
  await seedQuizQuestions()
  await seedCourses()

  const counts = {
    users: await prisma.user.count(),
    equipment: await prisma.equipment.count(),
    modules: await prisma.module.count(),
    hotspots: await prisma.hotspot.count(),
    hotspotCategories: await prisma.hotspotCategory.count(),
    checklistItems: await prisma.checklistItem.count(),
    quizQuestions: await prisma.quizQuestion.count(),
    courses: await prisma.course.count(),
  }
  console.log('Seed complete:', counts)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
