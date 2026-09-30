// A real PostgreSQL database for the route tests, never the development one.
//
// Import this before anything that imports src/lib/prisma.js: it points
// DATABASE_URL at the test database, and PrismaClient reads it when it is
// created. The test database is DATABASE_URL's with `_test` appended to its
// name (gearview3d -> gearview3d_test), or TEST_DATABASE_URL when set; it is
// brought up to date with `prisma migrate deploy`, which also creates it, so
// the tests run against the migrations exactly as a deployment applies them.
//
// Every table is emptied between tests (resetDatabase), which is why this
// refuses any database whose name does not end in `_test`, and why the test
// files run one at a time (`--test-concurrency=1` in package.json).
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error('The route tests need PostgreSQL: set DATABASE_URL (backend/.env) or TEST_DATABASE_URL.')
  }
  const url = new URL(process.env.DATABASE_URL)
  url.pathname = `${url.pathname.replace(/\/$/, '')}_test`
  return url.href
}

const url = testDatabaseUrl()
const databaseName = new URL(url).pathname.slice(1)
if (!databaseName.endsWith('_test')) {
  throw new Error(`Refusing to run the route tests against "${databaseName}": its name must end in _test.`)
}

process.env.DATABASE_URL = url
process.env.JWT_SECRET ||= 'route-tests-only-secret'

const backendDir = fileURLToPath(new URL('../..', import.meta.url))
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  cwd: backendDir,
  env: process.env,
  stdio: 'pipe',
})

const { prisma } = await import('../../src/lib/prisma.js')
export { prisma }

// Every table the schema has, emptied in one statement.
export async function resetDatabase() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (!tables.length) return
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`)
}
