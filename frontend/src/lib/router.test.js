import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyRedirect, moduleRoute, routes } from './router.js'

test('the old equipment catalog redirects to the training hub', () => {
  assert.equal(legacyRedirect('/catalog'), routes.home)
})

test('the pre-generic module list and its module pages redirect into /training/modules', () => {
  assert.equal(legacyRedirect('/training/forklift/equipment'), routes.modules)
  assert.equal(legacyRedirect('/training/forklift/equipment/walk-around'), moduleRoute('walk-around-check'))
  assert.equal(legacyRedirect('/training/forklift/equipment/load-handling'), moduleRoute('load-handling'))
})

test('/training/forklift and everything under it drop the equipment segment', () => {
  assert.equal(legacyRedirect('/training/forklift'), routes.home)
  assert.equal(legacyRedirect('/training/forklift/modules'), routes.modules)
  assert.equal(legacyRedirect('/training/forklift/modules/load-handling'), moduleRoute('load-handling'))
  assert.equal(legacyRedirect('/training/forklift/parts'), routes.parts)
  assert.equal(legacyRedirect('/training/forklift/assessment'), routes.assessment)
})

test('current and unrelated paths are not legacy URLs', () => {
  for (const path of ['/', '/login', '/training', '/training/modules', '/training/modules/load-handling', '/admin', '/training/forklifts', '/catalogue']) {
    assert.equal(legacyRedirect(path), null, path)
  }
})
