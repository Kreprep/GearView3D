// Server-side quiz scoring.
//
// The correct answers never leave the database until a learner has submitted:
// the content endpoints send prompts and options only, this file compares the
// submitted choices against the stored answers, and the attempt it writes is
// the one the reports are built from. Grading in the browser would mean both
// the answer key and the score were under the learner's control.
import { randomUUID } from 'node:crypto'
import { prisma } from './prisma.js'

// Answers arrive as the option text, which is what both quiz UIs already have
// in hand. Comparison is trimmed so a stray space in an option label does not
// mark a correct choice wrong.
function sameAnswer(submitted, answer) {
  return String(submitted ?? '').trim() === String(answer ?? '').trim()
}

// `questions` are rows with { id, answer }. Returns the score plus, per
// question, whether it was right and what the right answer was - safe to send
// back now, because the attempt has already been recorded.
export function scoreAnswers(questions, submitted = {}) {
  const results = {}
  let score = 0

  for (const question of questions) {
    const correct = sameAnswer(submitted[question.id], question.answer)
    if (correct) score += 1
    results[question.id] = { correct, correctAnswer: question.answer }
  }

  return {
    score,
    total: questions.length,
    percentage: questions.length ? Math.round((score / questions.length) * 100) : 0,
    results,
  }
}

export function buildAttempt({ score, total, percentage }) {
  return {
    id: randomUUID(),
    score,
    total,
    percentage,
    attemptedAt: new Date().toISOString(),
  }
}

// The progress document is one JSON blob the frontend also writes, so the
// attempt is merged into whatever is currently stored rather than replacing it.
// The client re-reads its copy from the server after submitting, so its next
// debounced push carries the attempt instead of overwriting it.
export async function appendAttempt(userId, attempt, place) {
  const snapshot = await prisma.progressSnapshot.findUnique({ where: { userId } })
  const data = snapshot?.data || { version: 1, checklists: {}, parts: { viewedPartIds: [], practiceAttempts: [] }, quizzes: {}, simulations: {} }
  const next = place(data, attempt)

  await prisma.progressSnapshot.upsert({
    where: { userId },
    update: { data: next },
    create: { userId, data: next },
  })

  return next
}

export function intoModuleQuiz(moduleSlug) {
  return (data, attempt) => ({
    ...data,
    quizzes: {
      ...(data.quizzes || {}),
      [moduleSlug]: [attempt, ...((data.quizzes || {})[moduleSlug] || [])],
    },
  })
}

// Parts-quiz attempts. Forklift's keep going to `parts.practiceAttempts`,
// the key its progress percentage and the assessment page have always read -
// renaming it would strand every existing learner's attempts. Every other
// equipment's go to `parts.quizzes[equipmentId]`, which is per-equipment
// because that key never was.
export function intoPartsQuiz(equipmentId) {
  return (data, attempt) => {
    const parts = {
      ...(data.parts || {}),
      viewedPartIds: data.parts?.viewedPartIds || [],
      practiceAttempts: data.parts?.practiceAttempts || [],
      quizzes: data.parts?.quizzes || {},
    }

    if (equipmentId === 'forklift') {
      parts.practiceAttempts = [attempt, ...parts.practiceAttempts]
    } else {
      parts.quizzes = { ...parts.quizzes, [equipmentId]: [attempt, ...(parts.quizzes[equipmentId] || [])] }
    }

    return { ...data, parts }
  }
}
