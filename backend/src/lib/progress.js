// Reads and writes of a learner's ProgressSnapshot, and the revision that
// keeps a reset from being undone.
//
// The browser keeps its own copy of the progress document and pushes it whole
// (frontend lib/progressService.js), so after an instructor resets a learner
// who is still signed in, that copy would be written straight back. A reset
// therefore bumps `revision`; the client reads the revision with the document,
// sends it back as `baseRevision` with every write, and a write based on any
// other revision is refused (the route answers 409) and the client re-reads.
//
// Only a reset changes the revision. Quiz grading writes the document too, but
// through mergeProgress(), which leaves it alone: bumping it there would
// refuse the learner's very next push after every quiz.
import { prisma } from './prisma.js'

export function emptyProgressData() {
  return {
    version: 1,
    checklists: {},
    parts: { viewedPartIds: [], quizAttempts: [] },
    quizzes: {},
    simulations: {},
  }
}

// The document as the client keeps it, with the revision it is based on, or
// null when the learner has saved nothing (revision 0 is implied).
export async function readProgress(userId) {
  const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId } })
  return snapshot ? { ...snapshot.data, revision: snapshot.revision } : null
}

// A missing or malformed base reads as 0, the revision every snapshot starts
// at, so a client from before revisions existed keeps saving until the first
// reset and is refused after it.
export function parseBaseRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

// The revision travels beside the document, not in it.
export function withoutRevisionFields(document) {
  const { revision: _revision, baseRevision: _baseRevision, ...data } = document
  return data
}

// Writes `data` over the learner's document if it is still at `baseRevision`.
// Returns { snapshot } when it was written and { stale: true } when a reset got
// there first. The check and the write are one statement, so a reset landing
// between them cannot be overwritten.
export async function writeProgress(userId, data, baseRevision) {
  // Two passes at most: the second only runs when the row appeared between
  // this write's update and its create.
  for (let pass = 0; pass < 2; pass += 1) {
    const [snapshot] = await prisma.progressSnapshot.updateManyAndReturn({
      where: { userId, revision: baseRevision },
      data: { data },
    })
    if (snapshot) return { snapshot }

    const exists = await prisma.progressSnapshot.findUnique({ where: { userId }, select: { id: true } })
    // A new snapshot starts at revision 0, so only a write based on 0 may
    // create one.
    if (exists || baseRevision !== 0) return { stale: true }

    try {
      return { snapshot: await prisma.progressSnapshot.create({ data: { userId, data } }) }
    } catch (error) {
      if (error?.code !== 'P2002') throw error
    }
  }
  return { stale: true }
}

const MERGE_ATTEMPTS = 5

// Server-side edits of the document (quiz grading): `merge(data)` returns the
// next document from the current one. Written against the revision it was read
// at, so a reset in between is not undone; it is merged into the reset
// document instead. The revision itself is never changed here.
export async function mergeProgress(userId, merge) {
  // Each pass that loses lost to another write, which takes milliseconds; a
  // learner's own browser pushes at most once per 800 ms.
  for (let pass = 0; pass < MERGE_ATTEMPTS; pass += 1) {
    const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId } })
    const next = merge(snapshot?.data || emptyProgressData())
    const result = await writeProgress(userId, next, snapshot?.revision ?? 0)
    if (!result.stale) return next
  }
  throw new Error(`Progress for ${userId} kept changing while it was being merged`)
}

// Clears the document and bumps the revision. A learner with no snapshot yet
// gets one at revision 1, so a copy their browser has not pushed yet is
// refused too.
export async function resetProgress(userId) {
  const data = emptyProgressData()
  return prisma.progressSnapshot.upsert({
    where: { userId },
    update: { data, revision: { increment: 1 } },
    create: { userId, data, revision: 1 },
  })
}
