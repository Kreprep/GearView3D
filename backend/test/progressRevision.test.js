// The reset race (plan 4.7): a browser the learner is still signed in on must
// not write its copy of their progress back over a reset, and a quiz graded on
// the server must not make that browser's next save look stale. Needs
// PostgreSQL (see helpers/testDatabase.js).
import { bearer, ids, loadFixtures, prisma } from './helpers/fixtures.js'
import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { mergeProgress, writeProgress } from '../src/lib/progress.js'

const app = createApp()

const saved = {
  version: 1,
  checklists: { [ids.moduleSlug]: { completedItems: ['Check the forks'] } },
  parts: { viewedPartIds: ['mast'], quizAttempts: [] },
  quizzes: {},
  simulations: {},
}

const getProgress = () => request(app).get('/api/progress').set('Authorization', bearer(ids.trainee))
const putProgress = (body) => request(app).put('/api/progress').set('Authorization', bearer(ids.trainee)).send(body)
const resetTrainee = () =>
  request(app).post(`/api/admin/users/${ids.trainee}/progress/reset`).set('Authorization', bearer(ids.instructor))

beforeEach(loadFixtures)
after(() => prisma.$disconnect())

test('a learner with nothing saved reads null, and a first save at revision 0 creates the snapshot', async () => {
  assert.equal((await getProgress()).body, null)

  const response = await putProgress({ ...saved, baseRevision: 0 })
  assert.equal(response.status, 200)
  assert.equal(response.body.revision, 0)

  const { body } = await getProgress()
  assert.equal(body.revision, 0)
  assert.deepEqual(body.parts.viewedPartIds, ['mast'])
})

test('the revision travels beside the document and is never stored in it', async () => {
  await putProgress({ ...saved, revision: 7, baseRevision: 0 })
  const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId: ids.trainee } })
  assert.equal('revision' in snapshot.data, false)
  assert.equal('baseRevision' in snapshot.data, false)
  assert.equal(snapshot.revision, 0)
})

test('a stale save after a reset is refused with 409 and the reset stands', async () => {
  await putProgress({ ...saved, baseRevision: 0 })

  const reset = await resetTrainee()
  assert.equal(reset.status, 200)
  assert.equal(reset.body.revision, 1)

  // The trainee's browser still holds the pre-reset copy, read at revision 0.
  const stale = await putProgress({ ...saved, baseRevision: 0 })
  assert.equal(stale.status, 409)

  const { body } = await getProgress()
  assert.equal(body.revision, 1)
  assert.deepEqual(body.checklists, {})
  assert.deepEqual(body.parts.viewedPartIds, [])

  // Re-read, the browser saves on the new revision.
  const fresh = await putProgress({ ...body, checklists: { [ids.moduleSlug]: { completedItems: ['a'] } }, baseRevision: body.revision })
  assert.equal(fresh.status, 200)
  assert.equal(fresh.body.revision, 1)
})

test('a save with no baseRevision, from a client older than revisions, counts as revision 0', async () => {
  await putProgress(saved)
  assert.equal((await putProgress(saved)).status, 200)
  await resetTrainee()
  assert.equal((await putProgress(saved)).status, 409)
})

test('a reset of a learner with nothing saved still refuses the copy their browser has not pushed yet', async () => {
  await resetTrainee()
  assert.equal((await putProgress({ ...saved, baseRevision: 0 })).status, 409)
  assert.equal((await getProgress()).body.revision, 1)
})

test('a quiz graded on the server leaves the revision alone, so the next save is accepted', async () => {
  await putProgress({ ...saved, baseRevision: 0 })
  await resetTrainee()
  const { body: afterReset } = await getProgress()

  const submit = await request(app)
    .post('/api/content/quizzes/submit')
    .set('Authorization', bearer(ids.trainee))
    .send({ context: 'parts', answers: { [ids.partsQuestion]: 'Forks' } })
  assert.equal(submit.status, 200)
  assert.equal(submit.body.score, 1)

  const { body: afterQuiz } = await getProgress()
  assert.equal(afterQuiz.revision, afterReset.revision)
  assert.equal(afterQuiz.parts.quizAttempts.length, 1)

  const next = await putProgress({ ...afterQuiz, baseRevision: afterQuiz.revision })
  assert.equal(next.status, 200)
})

test('a quiz submitted before the first save creates the snapshot at revision 0', async () => {
  await request(app)
    .post('/api/content/quizzes/submit')
    .set('Authorization', bearer(ids.trainee))
    .send({ module: ids.moduleSlug, answers: { [ids.moduleQuestion]: 'Tilt' } })

  const { body } = await getProgress()
  assert.equal(body.revision, 0)
  assert.equal(body.quizzes[ids.moduleSlug][0].score, 0)
})

test('a write based on the revision before a reset is refused, whoever makes it', async () => {
  // What the quiz grader's merge relies on: it reads the document, and if a
  // reset lands before its write, the write is refused and the merge re-read.
  await putProgress({ ...saved, baseRevision: 0 })
  const before = await prisma.progressSnapshot.findUnique({ where: { userId: ids.trainee } })
  await resetTrainee()

  const result = await writeProgress(ids.trainee, { ...before.data, marker: 'stale' }, before.revision)
  assert.deepEqual(result, { stale: true })

  const merged = await mergeProgress(ids.trainee, (data) => ({ ...data, marker: 'merged' }))
  assert.equal(merged.marker, 'merged')
  const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId: ids.trainee } })
  assert.equal(snapshot.revision, 1)
  assert.deepEqual(snapshot.data.checklists, {})
  assert.equal(snapshot.data.marker, 'merged')
})
