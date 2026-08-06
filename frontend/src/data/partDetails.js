// Imports keep explicit .js extensions so this file also loads in plain Node
// (the backend seed script imports it directly).
import { partsHotspots } from './partsData.js'
import { engineOffInspectionChecks } from './inspectionScenarios.js'
import { walkAroundViewerHotspots } from './viewerHotspots.js'

// Unified "Part Details" content shown when a part/hotspot is clicked, in both
// Parts Identification and the walk-around style modules. Each entry:
//   { id, title, subtitle, image, description }
// `description` is markdown — an admin can use bullet points, numbered lists,
// bold text, and inline images (`![alt](/images/x.png)`) anywhere in it.
// `image` is the reference image shown at the top of the detail card.
//
// Defaults below are composed from the existing structured data so nothing has
// to be re-written by hand; admin edits (stored through lib/api.js) override
// these per field.

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join('\n\n')
}

function partDescription(part) {
  return joinBlocks([
    part.functionText,
    part.inspectionReminder && `**What to inspect**\n\n${part.inspectionReminder}`,
    part.safetyNote && `**Safety**\n\n${part.safetyNote}`,
    part.checklist?.length &&
      `**Quick checklist**\n\n${part.checklist.map((item) => `- ${item}`).join('\n')}`,
    part.relatedModule && `*Related training: ${part.relatedModule}*`,
  ])
}

function inspectionDescription(check) {
  return joinBlocks([
    check.inspect,
    check.feedback && `**Why it matters**\n\n${check.feedback}`,
  ])
}

function hotspotDescription(hotspot) {
  return joinBlocks([
    hotspot.inspect,
    hotspot.unsafeFeedback && `**Why it matters**\n\n${hotspot.unsafeFeedback}`,
  ])
}

export function buildDefaultPartDetails() {
  const details = {}

  for (const part of partsHotspots) {
    details[part.id] = {
      id: part.id,
      title: part.label,
      subtitle: part.category,
      image: part.image || '',
      description: partDescription(part),
    }
  }

  for (const check of engineOffInspectionChecks) {
    if (details[check.id]) continue
    details[check.id] = {
      id: check.id,
      title: check.label,
      subtitle: check.targetArea,
      image: check.image || '',
      description: inspectionDescription(check),
    }
  }

  for (const hotspot of walkAroundViewerHotspots) {
    if (details[hotspot.id]) continue
    details[hotspot.id] = {
      id: hotspot.id,
      title: hotspot.label,
      subtitle: hotspot.category,
      image: hotspot.image || '',
      description: hotspotDescription(hotspot),
    }
  }

  return details
}
