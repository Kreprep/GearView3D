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
    'Follow safe load handling practices from OSHA powered industrial truck guidance.',
  ],
  3: [
    'Park on a level surface away from traffic and hazards.',
    'Lower forks completely to the ground.',
    'Place directional controls in neutral.',
    'Engage the parking brake.',
    'Turn off the ignition and secure the forklift.',
    'Report unsafe conditions or minor operational issues to the supervisor.',
  ],
}

const parts = [
  {
    id: 'forks',
    label: 'Forks',
    position: [0, 0.1, 0.62],
    functionText: 'Support and lift pallets or loads when correctly inserted and spaced.',
    safetyNote: 'Never stand under raised forks, and keep the load centered before lifting.',
    checklist: ['Check fork tips', 'Confirm locking pins', 'Keep load centered'],
  },
  {
    id: 'mast',
    label: 'Mast',
    position: [0, 0.42, 0.48],
    functionText: 'Guides the vertical movement of the carriage and forks.',
    safetyNote: 'Keep hands, feet, and loose clothing away from the mast and lift chain path.',
    checklist: ['Look for visible damage', 'Check lift path clearance', 'Raise load smoothly'],
  },
  {
    id: 'lift-chain',
    label: 'Lift Chain',
    position: [-0.08, 0.54, 0.46],
    functionText: 'Transfers lifting force through the mast assembly.',
    safetyNote: 'Do not touch or inspect the chain while the engine is running or the forks are moving.',
    checklist: ['Look for slack', 'Check for uneven movement', 'Keep clear while lifting'],
  },
  {
    id: 'carriage',
    label: 'Carriage',
    position: [0, 0.28, 0.54],
    functionText: 'Holds the forks and moves along the mast during lifting and lowering.',
    safetyNote: 'Confirm the carriage is stable before handling any load.',
    checklist: ['Check fork attachment', 'Check visible cracks', 'Confirm smooth travel'],
  },
  {
    id: 'operator-area',
    label: 'Operator Area',
    position: [0, 0.36, 0.08],
    functionText: 'Contains the seat, steering, pedals, levers, and dashboard controls used by the operator.',
    safetyNote: 'Fasten the seat belt and confirm controls are understood before operation.',
    checklist: ['Fasten seat belt', 'Check mirrors', 'Test horn and brakes'],
  },
  {
    id: 'overhead-guard',
    label: 'Overhead Guard',
    position: [0, 0.72, 0.05],
    functionText: 'Helps protect the operator from falling objects within the forklift safety limits.',
    safetyNote: 'Do not operate if the overhead guard is visibly damaged.',
    checklist: ['Check structural damage', 'Keep guard unobstructed', 'Never remove the guard'],
  },
  {
    id: 'counterweight',
    label: 'Counterweight',
    position: [0, 0.18, -0.22],
    functionText: 'Balances the forklift against the weight of the load.',
    safetyNote: 'Watch rear swing and never exceed the rated load capacity.',
    checklist: ['Avoid overloading', 'Watch rear swing', 'Respect capacity plate'],
  },
  {
    id: 'tires',
    label: 'Tires',
    position: [0.34, 0.08, 0.03],
    functionText: 'Support forklift movement and stability across the work surface.',
    safetyNote: 'Damaged or underinflated tires can affect stability and steering.',
    checklist: ['Check visible wear', 'Check inflation or damage', 'Report unsafe tire condition'],
  },
  {
    id: 'capacity-plate',
    label: 'Capacity Plate',
    position: [0.18, 0.34, 0.15],
    functionText: 'Shows rated load capacity and important forklift specifications.',
    safetyNote: 'Do not lift a load beyond the capacity shown on the plate.',
    checklist: ['Read rated capacity', 'Confirm load center', 'Follow plate limits'],
  },
  {
    id: 'warning-devices',
    label: 'Warning Devices',
    position: [0, 0.53, -0.08],
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

    for (const [index, text] of checklists[module.id].entries()) {
      await prisma.checklistItem.create({
        data: {
          moduleId: module.id,
          text,
          sortOrder: index + 1,
        },
      })
    }
  }

  for (const part of parts) {
    await prisma.part.upsert({
      where: { id: part.id },
      update: {
        equipmentId: equipment.id,
        label: part.label,
        functionText: part.functionText,
        safetyNote: part.safetyNote,
        positionX: part.position[0],
        positionY: part.position[1],
        positionZ: part.position[2],
        checklist: part.checklist,
      },
      create: {
        id: part.id,
        equipmentId: equipment.id,
        label: part.label,
        functionText: part.functionText,
        safetyNote: part.safetyNote,
        positionX: part.position[0],
        positionY: part.position[1],
        positionZ: part.position[2],
        checklist: part.checklist,
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
