// Where the seed puts a built-in step it creates in a module that already has
// rows.
//
// The seed is create-if-missing, and a new stock step's own sortOrder is its
// place in *today's* stock list. In a database seeded by an earlier release
// that number is already taken (and the admin may have reordered the module
// since), so creating the row with it would tie with an existing step, and a
// step added before the summary would sort after it. Instead the new row goes
// straight after its nearest stock predecessor that the module still has, and
// every row from there on moves down one. The admin's order of the existing
// rows is kept; only the gap for the new one is opened.
//
// `stockIds` is the module's built-in step ids in stock order, `stored` the
// module's rows as { id, sortOrder } (any order), `id` the step being created.
// Returns { sortOrder, shifted: [{ id, sortOrder }] }: the new row's
// sortOrder and the rows whose sortOrder has to change to make room.
export function placeNewStep(stockIds, stored, id) {
  const byId = new Map(stored.map((row) => [row.id, row]))
  const index = stockIds.indexOf(id)
  const predecessor = stockIds.slice(0, Math.max(index, 0)).reverse().find((stockId) => byId.has(stockId))
  const successor = stockIds.slice(index + 1).find((stockId) => byId.has(stockId))
  const orders = stored.map((row) => row.sortOrder)

  let sortOrder
  if (predecessor) sortOrder = byId.get(predecessor).sortOrder + 1
  else if (successor) sortOrder = byId.get(successor).sortOrder
  else sortOrder = orders.length ? Math.max(...orders) + 1 : 1

  const shifted = stored
    .filter((row) => row.sortOrder >= sortOrder)
    .map((row) => ({ id: row.id, sortOrder: row.sortOrder + 1 }))
  return { sortOrder, shifted }
}
