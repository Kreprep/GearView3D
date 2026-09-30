// The Skills Checklist on the server (docs/revisions/post-defense-plan.md 4.8):
// the catalogue with its module links, a learner's skills judged by
// frontend/src/lib/skillProgress.js (the one implementation, also the learner
// page's), and the sign-off trail.
//
// Sign-offs are the trust anchor. They are rows in SkillSignoffEvent, which
// only the skills.signoff routes write, and only ever by inserting: nothing
// here updates or deletes one. The progress document the evidence is read
// from is client-reported; a sign-off never is.
import { prisma } from './prisma.js'
import { readProgress } from './progress.js'
import { evaluateSkills, SKILL_CATEGORIES } from '../../../frontend/src/lib/skillProgress.js'
import { defaultSkillFor, SKILL_DEFAULTS } from '../../../frontend/src/data/skillDefaults.js'

export { defaultSkillFor, SKILL_DEFAULTS }

// What an admin edits on a skill. The id is absent: sign-offs reference it.
export const skillFields = ['title', 'description', 'category', 'tesdaRef', 'evidence', 'sortOrder']

const LINKS = {
  include: { modules: { include: { module: { select: { slug: true } } }, orderBy: { moduleId: 'asc' } } },
}

// The titles an evidence rule names, so a page can say "Finish 'Driving
// course' (Load Handling)" rather than show ids: { modules: { slug: title },
// steps: { stepId: title } }. Step titles are the published columns.
async function evidenceLabels() {
  const [modules, courses] = await Promise.all([
    prisma.module.findMany({ select: { slug: true, title: true } }),
    prisma.course.findMany({ select: { id: true, title: true } }),
  ])
  return {
    modules: Object.fromEntries(modules.map((module) => [module.slug, module.title])),
    steps: Object.fromEntries(courses.map((course) => [course.id, course.title])),
  }
}

// A rule with the titles it names beside it. The extra keys are display only:
// skillProgress.js ignores them and normalizeEvidence() drops them on save.
function labelledRule(rule, labels) {
  const moduleTitle = rule.module ? labels.modules[rule.module] : undefined
  const stepTitle = rule.stepId ? labels.steps[rule.stepId] : undefined
  return { ...rule, ...(moduleTitle && { moduleTitle }), ...(stepTitle && { stepTitle }) }
}

// A skill as every reader gets it: its columns and the modules it is linked
// to, by slug (the key the pages and progress use) and by id (the editor's).
export function publicSkill(row, labels = { modules: {}, steps: {} }) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tesdaRef: row.tesdaRef,
    sortOrder: row.sortOrder,
    builtIn: row.builtIn,
    evidence: (Array.isArray(row.evidence) ? row.evidence : []).map((rule) => labelledRule(rule, labels)),
    modules: (row.modules || []).map((link) => ({
      moduleId: link.moduleId,
      moduleSlug: link.module?.slug,
      relation: link.relation,
    })),
  }
}

export async function listSkills() {
  const [rows, labels] = await Promise.all([
    prisma.skill.findMany({ ...LINKS, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    evidenceLabels(),
  ])
  return rows.map((row) => publicSkill(row, labels))
}

export async function findSkill(id) {
  const [row, labels] = await Promise.all([prisma.skill.findUnique({ where: { id }, ...LINKS }), evidenceLabels()])
  return row && publicSkill(row, labels)
}

export function isSkillCategory(value) {
  return SKILL_CATEGORIES.includes(value)
}

// A learner's sign-off events, newest first: the order the history shows.
export function signoffEventsFor(userId) {
  return prisma.skillSignoffEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

// An event as staff read it in the history. The actor is the name stored when
// they acted; `actorRemoved` says the account has since been deleted, which
// the page shows as "former staff".
export function historyEvent(event) {
  return {
    id: event.id,
    skillId: event.skillId,
    action: event.action,
    note: event.note,
    evidenceStatus: event.evidenceStatus,
    actorName: event.actorName,
    actorRemoved: event.actorId === null,
    createdAt: event.createdAt,
  }
}

// What a learner sees of their own sign-off: the stamp, never the notes
// (decided 2026-10-01).
function stamp(event) {
  return event && { actorName: event.actorName, actorRemoved: event.actorId === null, createdAt: event.createdAt }
}

// One learner's skills, judged: the catalogue, and per skill its status and
// the evidence met. `events` is their sign-off trail, newest first.
export async function evaluateUserSkills(userId) {
  const [skills, progress, hotspots, events] = await Promise.all([
    listSkills(),
    readProgress(userId),
    prisma.hotspot.findMany({ where: { published: true, inParts: true }, select: { id: true } }),
    signoffEventsFor(userId),
  ])
  const results = evaluateSkills(skills, progress, { hotspotIds: hotspots.map((hotspot) => hotspot.id), events })
  return { skills, results, events }
}

// The learner's own view: results with the stamp in place of the event.
export function learnerResults(results) {
  return results.map(({ signoff, ...result }) => ({ ...result, signoff: stamp(signoff) }))
}

export function staffResults(results) {
  return results.map(({ signoff, ...result }) => ({ ...result, signoff: signoff && historyEvent(signoff) }))
}

// Inserts one event. The only write this table ever gets.
export function recordSignoffEvent({ userId, skillId, actor, action, note, evidenceStatus }) {
  return prisma.skillSignoffEvent.create({
    data: { userId, skillId, actorId: actor.id, actorName: actor.fullName, action, note, evidenceStatus },
  })
}
