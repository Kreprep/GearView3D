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
import { buildDefaultPartCategories, partsHotspots } from '../../frontend/src/data/partsData.js'
// Quiz and practice answers live in their own files so the frontend bundle
// never imports them; the seed is the only consumer.
import { buildDefaultPracticeQuestions } from '../../frontend/src/data/practiceQuestions.js'
import { moduleQuizQuestions } from '../../frontend/src/data/moduleQuizzes.js'
import { buildDefaultPartDetails } from '../../frontend/src/data/partDetails.js'
import { buildDefaultCourses } from '../../frontend/src/data/courseDefaults.js'

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

async function seedParts() {
  for (const [index, part] of partsHotspots.entries()) {
    await prisma.part.upsert({
      where: { id: part.id },
      update: {},
      create: {
        id: part.id,
        label: part.label,
        category: part.category || 'General',
        position: part.position,
        functionText: part.functionText || '',
        inspectionReminder: part.inspectionReminder || '',
        safetyNote: part.safetyNote || '',
        relatedModule: part.relatedModule || '',
        checklist: part.checklist || [],
        sortOrder: index + 1,
      },
    })
  }
}

async function seedPartDetails() {
  for (const detail of Object.values(buildDefaultPartDetails())) {
    await prisma.partDetail.upsert({
      where: { id: detail.id },
      update: {},
      create: {
        id: detail.id,
        title: detail.title,
        subtitle: detail.subtitle || '',
        image: detail.image || '',
        description: detail.description || '',
      },
    })
  }
}

async function seedPartCategories() {
  for (const category of buildDefaultPartCategories()) {
    await prisma.partCategory.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    })
  }
}

async function seedPracticeQuestions() {
  for (const question of buildDefaultPracticeQuestions()) {
    await prisma.practiceQuestion.upsert({
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
          moduleId: module.id,
          prompt: question.prompt,
          answer: question.answer,
          sortOrder: index + 1,
          options: question.options.map((text, optionIndex) => ({
            id: `${question.id}-option-${optionIndex + 1}`,
            text,
            sortOrder: optionIndex + 1,
          })),
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
  await seedParts()
  await seedPartDetails()
  await seedPartCategories()
  await seedPracticeQuestions()
  await seedChecklists()
  await seedQuizQuestions()
  await seedCourses()

  const counts = {
    users: await prisma.user.count(),
    equipment: await prisma.equipment.count(),
    modules: await prisma.module.count(),
    parts: await prisma.part.count(),
    partDetails: await prisma.partDetail.count(),
    partCategories: await prisma.partCategory.count(),
    practiceQuestions: await prisma.practiceQuestion.count(),
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
