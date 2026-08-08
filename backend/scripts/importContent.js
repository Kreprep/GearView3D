// Applies prisma/content-export.json to this database.
//
//   npm run content:import            update + create, never delete
//   npm run content:import -- --prune also delete courses missing from the file
//
// Unlike `npm run seed`, which is create-if-missing so it can run on every boot
// without touching admin edits, this OVERWRITES existing rows - that is the
// point: it is how one person's edits reach everyone else.
//
// A local unpublished `draft` is left alone, because `draft` is not exported and
// an update only writes the keys it is given. The published columns underneath
// it are replaced, so the learner-visible content always matches the file.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { contentTables, exportPath } from './contentTables.js'

const prisma = new PrismaClient()
const prune = process.argv.includes('--prune')

async function main() {
  const file = JSON.parse(readFileSync(exportPath, 'utf8'))
  const summary = {}

  for (const table of contentTables) {
    const rows = file.tables?.[table.label] || []

    for (const row of rows) {
      const { id, ...rest } = row
      await prisma[table.model].upsert({ where: { id }, update: rest, create: row })
    }

    summary[table.label] = `${rows.length} written`

    if (prune && table.prunable) {
      const keep = rows.map((row) => row.id)
      const { count } = await prisma[table.model].deleteMany({ where: { id: { notIn: keep } } })
      if (count) summary[table.label] += `, ${count} deleted`
    }
  }

  console.log(`Content imported from ${file.exportedAt}:`, summary)
  if (!prune) console.log('Rows absent from the file were kept. Re-run with --prune to delete them.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
