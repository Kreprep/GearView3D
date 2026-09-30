import { useEffect, useState } from 'react'
import { getMySkills, getSkills } from '../lib/api'

const EMPTY = { practise: [], need: [] }

// The skills linked to one module, split by relation: `practise` is what the
// module teaches, `need` what it expects the learner to bring. Each entry is
// { skill, status }, the status the learner's own (GET /api/progress/skills).
//
// Optional to the page: a failed fetch leaves both lists empty rather than
// breaking the module.
export function useModuleSkills(moduleSlug) {
  const [lists, setLists] = useState(EMPTY)

  useEffect(() => {
    let cancelled = false

    Promise.all([getSkills(), getMySkills()])
      .then(([skills, mine]) => {
        if (cancelled) return
        const statusOf = Object.fromEntries(mine.results.map((result) => [result.skillId, result.status]))
        const linked = (relation) =>
          skills
            .filter((skill) => skill.modules.some((link) => link.moduleSlug === moduleSlug && link.relation === relation))
            .map((skill) => ({ skill, status: statusOf[skill.id] || 'not-started' }))
        setLists({ practise: linked('teaches'), need: linked('requires') })
      })
      .catch(() => {
        if (!cancelled) setLists(EMPTY)
      })

    return () => {
      cancelled = true
    }
  }, [moduleSlug])

  return lists
}
