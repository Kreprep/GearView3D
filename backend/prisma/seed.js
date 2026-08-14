// Seeds the database from the frontend's data files so the content only lives
// in one place. Existing rows are left untouched (create-if-missing), so
// re-running the seed never overwrites admin edits made through the dashboard.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import {
  allEquipment,
  moduleChecklists,
  trainingModules,
} from '../../frontend/src/data/trainingModules.js'
import { buildDefaultHotspotCategories } from '../../frontend/src/data/partsData.js'
// Quiz answers live in their own files so the frontend bundle never imports
// them; the seed is the only consumer.
import { buildDefaultPartsQuizQuestions } from '../../frontend/src/data/partsQuizzes.js'
import { moduleQuizQuestions } from '../../frontend/src/data/moduleQuizzes.js'
import { buildDefaultCourses, emptyCourseContent } from '../../frontend/src/data/courseDefaults.js'
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
    email: 'trainee@mail.com',
    password: 'trainee123',
    fullName: 'Sample Trainee',
    role: 'TRAINEE',
  },
]

async function seedUsers() {
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

async function seedEquipment() {
  for (const [index, equipment] of allEquipment.entries()) {
    await prisma.equipment.upsert({
      where: { id: equipment.id },
      update: {},
      create: {
        id: equipment.id,
        title: equipment.title,
        description: equipment.description,
        modelUrl: equipment.modelUrl || '',
        imageUrl: equipment.imageUrl || '',
        sortOrder: index + 1,
        available: equipment.available !== false,
      },
    })
  }
}

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
          equipmentId: 'forklift',
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
  }
}

// The one starter module every newly-added equipment type gets: a single
// blank module with a single blank briefing step, so the catalog card has
// somewhere to route to and the admin has something to open in the Module
// Editor / Course editor rather than an empty list. Create-if-missing, same
// as the rest of this file, so admin edits are never overwritten.
const equipmentStarterModules = [
  {
    equipmentId: 'backhoe',
    id: 5,
    slug: 'backhoe-getting-started',
    title: 'New Module',
    subtitle: 'Getting Started',
    description: 'A starting point for Backhoe Loader training content. Edit this module in the Module Editor to add your own steps.',
  },
]

async function seedEquipmentStarterModules() {
  for (const starter of equipmentStarterModules) {
    const existingModule = await prisma.module.findUnique({ where: { id: starter.id } })

    await prisma.module.upsert({
      where: { id: starter.id },
      update: {},
      create: {
        id: starter.id,
        slug: starter.slug,
        title: starter.title,
        subtitle: starter.subtitle,
        description: starter.description,
        equipmentId: starter.equipmentId,
        sortOrder: 1,
      },
    })

    // subtitle/description are newer than this row, so a row seeded before
    // they existed gets them backfilled here too - same as fullTitle in
    // seedModules() above. Only an empty value is replaced.
    if (existingModule && !existingModule.subtitle && !existingModule.description) {
      await prisma.module.update({
        where: { id: starter.id },
        data: { subtitle: starter.subtitle, description: starter.description },
      })
    }

    const briefingId = `${starter.slug}-briefing`
    const existing = await prisma.course.findUnique({ where: { id: briefingId } })
    if (existing) continue

    await prisma.course.create({
      data: {
        id: briefingId,
        moduleSlug: starter.slug,
        sortOrder: 1,
        kind: 'briefing',
        title: 'Briefing',
        content: emptyCourseContent('briefing'),
        published: true,
        builtIn: false,
      },
    })
  }
}

// Forklift's stock markers - its parts, its inspection hotspots, and the
// detail cards for both, which are one row each now. Every other equipment
// starts with none; an admin places them in the dashboard.
async function seedHotspots() {
  for (const hotspot of buildDefaultHotspots('forklift')) {
    await prisma.hotspot.upsert({
      where: { id: hotspot.id },
      update: {},
      create: { ...hotspot, published: true, builtIn: true },
    })
  }
}

async function seedHotspotCategories() {
  for (const category of buildDefaultHotspotCategories('forklift')) {
    await prisma.hotspotCategory.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    })
  }
}

// Forklift's parts quiz. Every other equipment starts with no parts
// questions; an admin adds them in the dashboard.
async function seedPartsQuizQuestions() {
  for (const question of buildDefaultPartsQuizQuestions('forklift')) {
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
          equipmentId: module.equipmentId || 'forklift',
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
    // exception: a content key added to the defaults *after* a row was seeded
    // is backfilled, because the row has no value for it at all. Keys the row
    // already has - including ones an admin deliberately blanked - always win.
    if (!existing.builtIn || !course.content) continue

    const current = existing.content || {}
    const missing = Object.keys(course.content).filter((key) => !(key in current))
    if (!missing.length) continue

    await prisma.course.update({
      where: { id: course.id },
      data: { content: { ...course.content, ...current } },
    })
  }
}

async function main() {
  await seedUsers()
  await seedEquipment()
  await seedModules()
  await seedEquipmentStarterModules()
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
