// Seeds the database from the frontend's data files so the content only lives
// in one place. Existing rows are left untouched (create-if-missing), so
// re-running the seed never overwrites admin edits made through the dashboard.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import {
  forkliftEquipment,
  moduleChecklists,
  moduleQuizQuestions,
  trainingModules,
} from '../../frontend/src/data/trainingModules.js'
import { partsHotspots } from '../../frontend/src/data/partsData.js'
import { buildDefaultPartDetails } from '../../frontend/src/data/partDetails.js'

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
  await prisma.equipment.upsert({
    where: { id: forkliftEquipment.id },
    update: {},
    create: {
      id: forkliftEquipment.id,
      title: forkliftEquipment.title,
      description: forkliftEquipment.description,
      modelUrl: forkliftEquipment.modelUrl,
      imageUrl: forkliftEquipment.imageUrl || '',
      sortOrder: 1,
    },
  })
}

async function seedModules() {
  for (const [index, module] of trainingModules.entries()) {
    await prisma.module.upsert({
      where: { id: module.id },
      update: {},
      create: {
        id: module.id,
        slug: module.slug,
        title: module.title,
        subtitle: module.subtitle || '',
        description: module.description || '',
        imageUrl: module.imageUrl || '',
        sortOrder: index + 1,
      },
    })
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

async function main() {
  await seedUsers()
  await seedEquipment()
  await seedModules()
  await seedParts()
  await seedPartDetails()
  await seedChecklists()
  await seedQuizQuestions()

  const counts = {
    users: await prisma.user.count(),
    equipment: await prisma.equipment.count(),
    modules: await prisma.module.count(),
    parts: await prisma.part.count(),
    partDetails: await prisma.partDetail.count(),
    checklistItems: await prisma.checklistItem.count(),
    quizQuestions: await prisma.quizQuestion.count(),
  }
  console.log('Seed complete:', counts)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
