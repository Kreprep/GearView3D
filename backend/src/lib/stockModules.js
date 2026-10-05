// How the seed adds a stock module, and the skill links that point at one, to
// a database that is already in use (module improvements Phase 7: the Final
// Driving Test is the first module added after deployment).
//
// The seed is create-if-missing. A module is found by its slug, which never
// changes, rather than by its id: Module.id is a plain Int that the admin's
// "Add module" also hands out (the next free one), so on a database where an
// admin made a module of their own, the stock id may already be someone
// else's.

// The id and sortOrder of a stock module the seed is about to create.
// `stored` is every module row as { id, sortOrder }. It keeps its stock id
// when that is free, and goes after every module already there, so on an
// empty database the stock modules come out in their stock order.
export function newModuleRow(stockId, stored) {
  const ids = stored.map((row) => row.id)
  const orders = stored.map((row) => row.sortOrder)
  return {
    id: ids.includes(stockId) ? Math.max(...ids) + 1 : stockId,
    sortOrder: orders.length ? Math.max(...orders) + 1 : 1,
  }
}

// A stock skill's module links as rows to create: { moduleId, relation }.
// `moduleIds` maps a slug to its id; a link to a module the database does not
// have is skipped. With `onlySlugs`, only links to those modules: for a skill
// that already exists, the links to a module the seed has just created, since
// its other links were made with it and one an admin removed stays removed.
export function stockSkillLinks(skill, moduleIds, onlySlugs = null) {
  return skill.modules
    .filter((link) => moduleIds[link.module] !== undefined && (!onlySlugs || onlySlugs.has(link.module)))
    .map((link) => ({ moduleId: moduleIds[link.module], relation: link.relation }))
}
