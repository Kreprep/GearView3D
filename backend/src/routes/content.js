import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/equipment', async (req, res) => {
  const equipment = await prisma.equipment.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(equipment)
})

router.get('/modules', async (req, res) => {
  const modules = await prisma.module.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(modules)
})

router.get('/parts', async (req, res) => {
  const parts = await prisma.part.findMany({ orderBy: { sortOrder: 'asc' } })
  res.json(parts)
})

// Returned as an object keyed by id, matching the shape the frontend uses.
router.get('/part-details', async (req, res) => {
  const details = await prisma.partDetail.findMany()
  res.json(Object.fromEntries(details.map((detail) => [detail.id, detail])))
})

// Returns the checklist texts for one module, in order.
router.get('/checklists/:moduleSlug', async (req, res) => {
  const module = await prisma.module.findUnique({ where: { slug: req.params.moduleSlug } })
  if (!module) {
    return res.json([])
  }

  const items = await prisma.checklistItem.findMany({
    where: { moduleId: module.id },
    orderBy: { sortOrder: 'asc' },
  })
  res.json(items.map((item) => item.text))
})

export default router
