import '../test-helpers/browserGlobals.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hubContentContext, hubContentDefault, overrideKey, resolveHubContent } from './hubContent.js'

const context = hubContentContext({
  equipmentTitle: 'Forklift',
  learnerName: 'Juan',
  hasPartsPage: true,
})

test('overrideKey leaves English unsuffixed and suffixes every other language', () => {
  assert.equal(overrideKey('heading', 'en'), 'heading')
  assert.equal(overrideKey('heading', undefined), 'heading')
  assert.equal(overrideKey('heading', 'fil'), 'heading_fil')
})

test('no content row at all renders the coded default in the asked-for language', () => {
  assert.equal(resolveHubContent(null, context).partsTitle, 'Learn the parts')
  assert.equal(resolveHubContent(null, context, 'fil').partsTitle, 'Alamin ang mga parte')
})

test('a pre-existing flat content row still renders in English mode', () => {
  // Every row already in the live database is exactly this shape - that is why
  // the English layer is unsuffixed and no migration was needed.
  const equipment = { content: { partsTitle: 'Forklift components' } }
  assert.equal(resolveHubContent(equipment, context).partsTitle, 'Forklift components')
})

test('a flat English override also wins in Filipino mode, ahead of the stock translation', () => {
  const equipment = { content: { partsTitle: 'Forklift components' } }
  assert.equal(resolveHubContent(equipment, context, 'fil').partsTitle, 'Forklift components')
})

test('a suffixed override wins over the English one for its own language only', () => {
  const equipment = { content: { partsTitle: 'Forklift components', partsTitle_fil: 'Mga bahagi' } }
  assert.equal(resolveHubContent(equipment, context, 'fil').partsTitle, 'Mga bahagi')
  assert.equal(resolveHubContent(equipment, context, 'en').partsTitle, 'Forklift components')
})

test('a blank or whitespace override is not an override', () => {
  const equipment = { content: { partsTitle: '   ', partsTitle_fil: '' } }
  assert.equal(resolveHubContent(equipment, context, 'fil').partsTitle, 'Alamin ang mga parte')
  assert.equal(resolveHubContent(equipment, context, 'en').partsTitle, 'Learn the parts')
})

test('tokens are substituted after resolution, in defaults and overrides alike', () => {
  assert.equal(
    resolveHubContent(null, context).partsDescription,
    'See each part of the Forklift and what it does.',
  )
  assert.equal(resolveHubContent(null, context).heading, 'Welcome back, Juan.')
  assert.equal(
    resolveHubContent({ content: { heading_fil: 'Kumusta, {learner}!' } }, context, 'fil').heading,
    'Kumusta, Juan!',
  )
})

test('hasPartsPage picks the whole sentence, not a glued-on clause', () => {
  assert.match(resolveHubContent(null, context).overallDescription, /and parts identification/)
  assert.doesNotMatch(
    resolveHubContent(null, hubContentContext({ equipmentTitle: 'Forklift' })).overallDescription,
    /and parts identification/,
  )
})

test('hubContentDefault is the same string the editor shows as a placeholder', () => {
  assert.equal(hubContentDefault('partsCta', context, 'fil'), 'Buksan ang mga parte')
  assert.equal(hubContentDefault('nope', context, 'fil'), '')
})

test('the entry requirements quote TR section 3.3 verbatim, in English in both languages, with the citation', () => {
  const quoted = [
    'Trainees or students who wish to enter this training should possess the following requirements:',
    '- At least Junior High School Level Completer or an Alternative Learning System (ALS) Certificate of Completion with grade 10 equivalent holder',
    '- Must possess good communication skills',
    '- Can perform basic mathematical computation',
    '- Physically fit',
  ]
  for (const lang of ['en', 'fil']) {
    const text = resolveHubContent(null, context, lang).entryRequirements
    for (const line of quoted) assert.ok(text.includes(line), `${lang}: ${line}`)
    assert.match(text, /Heavy Equipment Operation \(Forklift\) NC II, Revision 01 .*section 3\.3, page 93/)
  }
})
