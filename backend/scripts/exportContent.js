// Writes every content table to prisma/content-export.json so admin edits can
// be committed to git and imported on another machine (or the deployed server).
//
//   npm run content:export
//
// Rows come out in a stable order and the JSON is pretty-printed, so the diff
// after an editing session shows exactly which steps changed.
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { contentTables, exportPath, stripOmitted } from './contentTables.js'

const prisma = new PrismaClient()

async function main() {
  const tables = {}
  const counts = {}

  for (const table of contentTables) {
    const rows = await prisma[table.model].findMany({ orderBy: table.orderBy })
    tables[table.label] = rows.map((row) => stripOmitted(row, table.omit))
    counts[table.label] = rows.length
  }

  writeFileSync(
    exportPath,
    `${JSON.stringify({ exportedAt: new Date().toISOString(), counts, tables }, null, 2)}\n`,
  )

  console.log('Content exported to prisma/content-export.json:', counts)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
