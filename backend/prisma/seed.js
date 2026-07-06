import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const equipment = {
  id: 'forklift',
  title: 'Forklift',
  description: 'Learn safe forklift familiarization through guided lessons and a labeled 3D model.',
  modelUrl: '/models/Forklift_SEPERATED.glb',
}

const modules = [
  {
    id: 1,
    slug: 'walk-around-check',
    title: 'Walk-Around Check',
    subtitle: 'Visual Inspection',
    description:
      'Inspect the forklift before use by checking leaks, tires, mast, forks, gauges, lights, horn, brakes, and warning devices.',
    sortOrder: 1,
  },
  {
    id: 2,
    slug: 'load-handling',
    title: 'Load Handling',
    subtitle: 'Operational Controls',
    description:
      'Practice safe load handling concepts including approach, fork positioning, load stability, travel posture, and clear visibility.',
    sortOrder: 2,
  },
  {
    id: 3,
    slug: 'post-operation',
    title: 'Post-Operation',
    subtitle: 'Secure Parking',
    description:
      'Follow safe parking and shutdown steps after operation, including level parking, lowering forks, neutral controls, and brake engagement.',
    sortOrder: 3,
  },
]

const lessons = [
  {
    id: 'lesson-walk-around',
    moduleId: 1,
    slug: 'walk-around-check',
    title: 'Walk-Around Check',
    summary: 'Pre-operation visual inspection and safety device checks.',
    sections: [
      ['Engine-Off Visual Checks', 'Check leaks, tires, forks, mast, carriage, and lift chain before operation.'],
      ['Engine-On Functional Checks', 'Confirm gauges, brakes, steering, lights, horn, beacon, and backup alarm respond correctly.'],
    ],
  },
  {
    id: 'lesson-load-handling',
    moduleId: 2,
    slug: 'load-handling',
    title: 'Load Handling',
    summary: 'Safe approach, lifting, stability, and travel concepts.',
    sections: [
      ['Approach and Fork Positioning', 'Approach slowly and squarely, then set the forks to the correct height before entering the pallet.'],
      ['Load Stability', 'Keep the load centered and low while traveling, and respect the rated capacity plate.'],
    ],
  },
  {
    id: 'lesson-post-operation',
    moduleId: 3,
    slug: 'post-operation',
    title: 'Post-Operation',
    summary: 'Safe parking, shutdown, and reporting sequence.',
    sections: [
      ['Safe Parking', 'Park on a level surface, lower forks, set controls to neutral, and engage the parking brake.'],
      ['Reporting', 'Report unsafe conditions or visible damage to the supervisor.'],
    ],
  },
]

const checklists = {
  1: [
    'Check for engine oil, hydraulic oil, coolant, and battery leaks.',
    'Inspect tires for damage, wear, or unsafe condition.',
    'Check forks, mast, carriage, and lift chain for visible damage.',
    'Confirm horn, lights, warning beacon, and backup alarm are working.',
    'Check gauges and dashboard indicators before operation.',
    'Confirm brakes, steering, and controls respond before entering the work area.',
  ],
  2: [
    'Approach the load slowly and squarely.',
    'Set forks to the correct height before entering the pallet.',
    'Keep the load centered and stable on the forks.',
    'Tilt the mast slightly back after lifting the load.',
    'Travel with the load low and maintain clear visibility.',
    'Follow safe load handling practices.',
  ],
  3: [
    'Park on a level surface.',
    'Lower forks completely.',
    'Set controls to neutral.',
    'Engage the parking brake.',
    'Turn off the equipment.',
    'Report unsafe conditions or visible damage.',
  ],
}

const partDetails = {
  forks: ['Load Handling Parts', 'Check fork tips, heel area, visible cracks, and locking pins before use.', 'Load Handling'],
  mast: ['Load Handling Parts', 'Look for visible damage, obstruction, or unsafe movement in the lift path.', 'Walk-Around Check'],
  'lift-chain': ['Load Handling Parts', 'Observe for slack, uneven movement, or visible damage before operation.', 'Walk-Around Check'],
  carriage: ['Load Handling Parts', 'Check fork attachment points and confirm there is no visible damage.', 'Load Handling'],
  'operator-area': ['Operator and Controls', 'Confirm controls are understood, accessible, and checked before operation.', 'Walk-Around Check'],
  'overhead-guard': ['Stability and Structure', 'Check for visible bending, cracks, or missing sections.', 'Walk-Around Check'],
  counterweight: ['Stability and Structure', 'Confirm rear clearance and observe rear swing when maneuvering.', 'Load Handling'],
  tires: ['Stability and Structure', 'Check for visible wear, damage, or unsafe tire condition.', 'Walk-Around Check'],
  'capacity-plate': ['Safety and Identification', 'Read the rated capacity and load center before handling loads.', 'Load Handling'],
  'warning-devices': ['Safety and Identification', 'Test horn, lights, beacon, and backup alarm during pre-operation checks.', 'Walk-Around Check'],
}

const quizQuestions = {
  1: [
    ['walk-fluid-leaks', 'What should be checked during a walk-around inspection?', ['Fluid leaks', 'Lunch schedule', 'Paint color', 'Radio volume'], 'Fluid leaks'],
    ['walk-warning-devices', 'Which devices should be tested before operation?', ['Horn and lights', 'Cup holder', 'Seat fabric', 'Dashboard color'], 'Horn and lights'],
    ['walk-tires', 'Why inspect tires before operation?', ['They affect stability and steering', 'They change the training score', 'They control the horn', 'They identify the operator'], 'They affect stability and steering'],
  ],
  2: [
    ['load-approach', 'How should the forklift approach a load?', ['Slowly and squarely', 'Quickly at an angle', 'With raised forks', 'Without checking the path'], 'Slowly and squarely'],
    ['load-travel', 'How should a forklift travel with a load?', ['With the load low', 'With the load high', 'With sudden turns', 'With blocked visibility'], 'With the load low'],
    ['load-capacity', 'What should be respected before lifting?', ['Rated capacity plate', 'Paint finish', 'Operator preference', 'Parking location only'], 'Rated capacity plate'],
  ],
  3: [
    ['post-forks', 'What should be done to the forks after operation?', ['Lower them completely', 'Leave them raised', 'Remove them', 'Paint them'], 'Lower them completely'],
    ['post-controls', 'Where should controls be placed during shutdown?', ['Neutral', 'Reverse', 'Lift position', 'Tilt position'], 'Neutral'],
    ['post-report', 'What should be reported after operation?', ['Unsafe conditions or visible damage', 'Only the weather', 'Only the operator name', 'Nothing ever'], 'Unsafe conditions or visible damage'],
  ],
}

const parts = [
  {
    id: 'forks',
    label: 'Forks',
    position: [0, 0.08, 0.58],
    functionText: 'Support and lift pallets or loads when correctly inserted and spaced.',
    safetyNote: 'Never stand under raised forks, and keep the load centered before lifting.',
    checklist: ['Check fork tips', 'Confirm locking pins', 'Keep load centered'],
  },
  {
    id: 'mast',
    label: 'Mast',
    position: [0, 0.44, 0.25],
    functionText: 'Guides the vertical movement of the carriage and forks.',
    safetyNote: 'Keep hands, feet, and loose clothing away from the mast and lift chain path.',
    checklist: ['Look for visible damage', 'Check lift path clearance', 'Raise load smoothly'],
  },
  {
    id: 'lift-chain',
    label: 'Lift Chain',
    position: [0.08, 0.54, 0.18],
    functionText: 'Transfers lifting force through the mast assembly.',
    safetyNote: 'Do not touch or inspect the chain while the engine is running or the forks are moving.',
    checklist: ['Look for slack', 'Check for uneven movement', 'Keep clear while lifting'],
  },
  {
    id: 'carriage',
    label: 'Carriage',
    position: [0, 0.13, 0.42],
    functionText: 'Holds the forks and moves along the mast during lifting and lowering.',
    safetyNote: 'Confirm the carriage is stable before handling any load.',
    checklist: ['Check fork attachment', 'Check visible cracks', 'Confirm smooth travel'],
  },
  {
    id: 'operator-area',
    label: 'Operator Area',
    position: [0, 0.34, -0.04],
    functionText: 'Contains the seat, steering, pedals, levers, and dashboard controls used by the operator.',
    safetyNote: 'Fasten the seat belt and confirm controls are understood before operation.',
    checklist: ['Fasten seat belt', 'Check mirrors', 'Test horn and brakes'],
  },
  {
    id: 'overhead-guard',
    label: 'Overhead Guard',
    position: [0, 0.78, -0.02],
    functionText: 'Helps protect the operator from falling objects within the forklift safety limits.',
    safetyNote: 'Do not operate if the overhead guard is visibly damaged.',
    checklist: ['Check structural damage', 'Keep guard unobstructed', 'Never remove the guard'],
  },
  {
    id: 'counterweight',
    label: 'Counterweight',
    position: [0, 0.18, -0.26],
    functionText: 'Balances the forklift against the weight of the load.',
    safetyNote: 'Watch rear swing and never exceed the rated load capacity.',
    checklist: ['Avoid overloading', 'Watch rear swing', 'Respect capacity plate'],
  },
  {
    id: 'tires',
    label: 'Tires',
    position: [0.12, 0.08, 0.19],
    functionText: 'Support forklift movement and stability across the work surface.',
    safetyNote: 'Damaged or underinflated tires can affect stability and steering.',
    checklist: ['Check visible wear', 'Check inflation or damage', 'Report unsafe tire condition'],
  },
  {
    id: 'capacity-plate',
    label: 'Capacity Plate',
    position: [0.1, 0.32, 0.03],
    functionText: 'Shows rated load capacity and important forklift specifications.',
    safetyNote: 'Do not lift a load beyond the capacity shown on the plate.',
    checklist: ['Read rated capacity', 'Confirm load center', 'Follow plate limits'],
  },
  {
    id: 'warning-devices',
    label: 'Warning Devices',
    position: [0, 0.66, -0.08],
    functionText: 'Includes lights, horn, and backup alarm used to alert nearby workers.',
    safetyNote: 'Do not operate if required warning devices are not working.',
    checklist: ['Test horn', 'Check lights', 'Check backup alarm'],
  },
]

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { email: 'admin@mail.com' },
    update: {
      passwordHash,
      fullName: 'GearView3D Admin',
      role: 'ADMIN',
    },
    create: {
      email: 'admin@mail.com',
      passwordHash,
      fullName: 'GearView3D Admin',
      role: 'ADMIN',
    },
  })

  await prisma.user.upsert({
    where: { email: 'trainee@mail.com' },
    update: {},
    create: {
      email: 'trainee@mail.com',
      passwordHash: await bcrypt.hash('trainee123', 12),
      fullName: 'Sample Trainee',
      role: 'TRAINEE',
    },
  })

  await prisma.equipment.upsert({
    where: { id: equipment.id },
    update: equipment,
    create: equipment,
  })

  for (const module of modules) {
    await prisma.trainingModule.upsert({
      where: { id: module.id },
      update: { ...module, equipmentId: equipment.id },
      create: { ...module, equipmentId: equipment.id },
    })

    await prisma.checklistItem.deleteMany({ where: { moduleId: module.id } })
    await prisma.quizQuestion.deleteMany({ where: { moduleId: module.id } })

    for (const [index, text] of checklists[module.id].entries()) {
      await prisma.checklistItem.create({
        data: {
          moduleId: module.id,
          text,
          sortOrder: index + 1,
        },
      })
    }

    for (const [index, [id, prompt, options, answer]] of quizQuestions[module.id].entries()) {
      await prisma.quizQuestion.create({
        data: {
          id,
          moduleId: module.id,
          prompt,
          answer,
          sortOrder: index + 1,
          options: {
            create: options.map((text, optionIndex) => ({
              text,
              sortOrder: optionIndex + 1,
            })),
          },
        },
      })
    }
  }

  for (const [index, lesson] of lessons.entries()) {
    await prisma.lesson.upsert({
      where: { id: lesson.id },
      update: {
        moduleId: lesson.moduleId,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        sortOrder: index + 1,
      },
      create: {
        id: lesson.id,
        moduleId: lesson.moduleId,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        sortOrder: index + 1,
      },
    })

    await prisma.lessonSection.deleteMany({ where: { lessonId: lesson.id } })

    for (const [sectionIndex, [heading, body]] of lesson.sections.entries()) {
      await prisma.lessonSection.create({
        data: {
          lessonId: lesson.id,
          heading,
          body,
          sortOrder: sectionIndex + 1,
        },
      })
    }

    await prisma.checklistItem.updateMany({
      where: { moduleId: lesson.moduleId },
      data: { lessonId: lesson.id },
    })
  }

  for (const part of parts) {
    const [category, inspectionReminder, relatedModule] = partDetails[part.id]

    await prisma.part.upsert({
      where: { id: part.id },
      update: {
        equipmentId: equipment.id,
        label: part.label,
        category,
        functionText: part.functionText,
        inspectionReminder,
        safetyNote: part.safetyNote,
        relatedModule,
        positionX: part.position[0],
        positionY: part.position[1],
        positionZ: part.position[2],
        checklist: part.checklist,
      },
      create: {
        id: part.id,
        equipmentId: equipment.id,
        label: part.label,
        category,
        functionText: part.functionText,
        inspectionReminder,
        safetyNote: part.safetyNote,
        relatedModule,
        positionX: part.position[0],
        positionY: part.position[1],
        positionZ: part.position[2],
        checklist: part.checklist,
      },
    })

    await prisma.partHotspot.deleteMany({ where: { partId: part.id } })
    await prisma.partHotspot.create({
      data: {
        partId: part.id,
        label: part.label,
        positionX: part.position[0],
        positionY: part.position[1],
        positionZ: part.position[2],
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('GearView3D seed data inserted.')
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
