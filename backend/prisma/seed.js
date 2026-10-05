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
import { withMissingCompletionCode } from '../../frontend/src/lib/courseGoals.js'
import {
  canonicalJson,
  COURSE_STOCK_FIELDS,
  MODULE_STOCK_FIELDS,
  SKILL_STOCK_FIELDS,
  staleStockUpgrades,
} from '../src/lib/stockHistory.js'
import { placeNewStep } from '../src/lib/stepOrder.js'
import { STOCK_HISTORY } from './stockHistory.js'
import { EQUIPMENT_DEFAULTS } from '../../frontend/src/data/equipment.js'
import { buildDefaultHotspots } from '../../frontend/src/data/hotspotDefaults.js'
import { SKILL_DEFAULTS, skillRowDefaults } from '../../frontend/src/data/skillDefaults.js'

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

    // Untouched stock from an earlier release (the card's title, description,
    // artwork) moves to today's; anything an admin typed is left alone
    // (src/lib/stockHistory.js).
    const stock = { ...module, fullTitle: module.fullTitle || module.title }
    const upgrades = staleStockUpgrades(existing, stock, STOCK_HISTORY.Module?.[module.slug], MODULE_STOCK_FIELDS)
    if (Object.keys(upgrades).length) {
      await prisma.module.update({ where: { id: module.id }, data: upgrades })
      Object.assign(existing, upgrades)
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
  const defaults = buildDefaultCourses()
  const stockIds = (moduleSlug) => defaults.filter((course) => course.moduleSlug === moduleSlug).map((course) => course.id)

  for (const course of defaults) {
    const existing = await prisma.course.findUnique({ where: { id: course.id } })

    if (!existing) {
      // A step new in this release lands after its stock predecessor, not on
      // its stock sortOrder, which an older database already uses
      // (src/lib/stepOrder.js). In an empty module that is the stock order.
      const stored = await prisma.course.findMany({ where: { moduleSlug: course.moduleSlug }, select: { id: true, sortOrder: true } })
      const { sortOrder, shifted } = placeNewStep(stockIds(course.moduleSlug), stored, course.id)
      await prisma.$transaction([
        ...shifted.map((row) => prisma.course.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } })),
        prisma.course.create({ data: { ...course, sortOrder, builtIn: true, published: true } }),
      ])
      continue
    }

    // Still create-if-missing for everything the admin can edit, with two
    // exceptions. Untouched stock from an earlier release is upgraded (below).
    // And a key added to the defaults *after* a row was seeded is
    // backfilled, because the row has no value for it at all. Keys the row
    // already has - including ones an admin deliberately blanked - always win.
    // That covers every content key, and in a driving step's data only the
    // safety signs' settings (a stock speed limit) and a free-practice step's
    // completion code (without which the step can never be finished): the
    // geometry is never touched.
    if (!existing.builtIn) continue

    // A field still holding an earlier release's stock value, never edited,
    // moves to today's stock (src/lib/stockHistory.js). Fields an admin
    // changed match no earlier stock and are left alone.
    const history = STOCK_HISTORY.Course?.[course.id]
    const row = { ...existing, ...staleStockUpgrades(existing, course, history) }
    const draft = existing.draft && { ...existing.draft, ...staleStockUpgrades(existing.draft, course, history) }
    const update = {}
    for (const field of COURSE_STOCK_FIELDS) {
      if (row[field] !== existing[field]) update[field] = row[field]
    }

    if (course.content) {
      const current = row.content || {}
      const missing = Object.keys(course.content).filter((key) => !(key in current))
      if (missing.length) update.content = { ...course.content, ...current }
    }

    let draftData = draft?.data
    if (course.kind === 'driving' && course.data) {
      const backfill = (stored) => withMissingCompletionCode(withMissingAlertDefaults(stored, course.data), course.data)
      const data = backfill(row.data)
      if (data !== existing.data) update.data = data
      // A pending draft is a whole payload: publishing it must not drop what
      // the published row was just given.
      draftData = backfill(draft?.data)
    }
    if (draft) {
      const nextDraft = { ...draft, ...(draftData !== undefined ? { data: draftData } : {}) }
      if (canonicalJson(nextDraft) !== canonicalJson(existing.draft)) update.draft = nextDraft
    }

    if (Object.keys(update).length) await prisma.course.update({ where: { id: course.id }, data: update })
  }
}

// The draft TR-mapped skill catalogue (data/skillDefaults.js), create-if-missing.
// A skill's module links are created with it and only then, so a link an admin
// removed stays removed; links to a module that does not exist are skipped.
// A built-in skill's wording or evidence still holding an earlier release's
// stock moves to today's (src/lib/stockHistory.js), which is how evidence for
// a new step reaches a deployed database; an edited field is left alone.
async function seedSkills() {
  const modules = await prisma.module.findMany({ select: { id: true, slug: true } })
  const moduleIds = Object.fromEntries(modules.map((module) => [module.slug, module.id]))

  for (const [index, skill] of SKILL_DEFAULTS.entries()) {
    const existing = await prisma.skill.findUnique({ where: { id: skill.id } })
    if (existing) {
      if (!existing.builtIn) continue
      const upgrades = staleStockUpgrades(existing, skillRowDefaults(skill, index), STOCK_HISTORY.Skill?.[skill.id], SKILL_STOCK_FIELDS)
      if (Object.keys(upgrades).length) await prisma.skill.update({ where: { id: skill.id }, data: upgrades })
      continue
    }

    const links = skill.modules
      .filter((link) => moduleIds[link.module])
      .map((link) => ({ moduleId: moduleIds[link.module], relation: link.relation }))
    await prisma.skill.create({
      data: { ...skillRowDefaults(skill, index), builtIn: true, modules: { create: links } },
    })
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
  await seedSkills()

  const counts = {
    users: await prisma.user.count(),
    equipment: await prisma.equipment.count(),
    modules: await prisma.module.count(),
    hotspots: await prisma.hotspot.count(),
    hotspotCategories: await prisma.hotspotCategory.count(),
    checklistItems: await prisma.checklistItem.count(),
    quizQuestions: await prisma.quizQuestion.count(),
    courses: await prisma.course.count(),
    skills: await prisma.skill.count(),
    moduleSkills: await prisma.moduleSkill.count(),
  }
  console.log('Seed complete:', counts)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
