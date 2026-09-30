import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PALLET_CONFIRM_SECONDS,
  PALLET_DROP_LEAN,
  PALLET_LEVEL_LEAN,
  PALLET_REST_SECONDS,
  PALLET_SET_DOWN_SPEED,
} from '../../data/palletProfile.js'
import { initialPalletState, nextPalletState } from './palletState.js'

const DT = 1 / 60
const steps = (seconds) => Math.ceil(seconds / DT) + 1

// Readings, as stepPallet builds them from the physics.
const onFloor = { onForks: false, supported: true, speed: 0, lean: 0, delivered: false }
const forksIn = { ...onFloor, onForks: true }
const lifted = { onForks: true, supported: false, speed: 0, lean: 0, delivered: false }
const inTheAir = { onForks: false, supported: false, speed: 0.5, lean: 0.1, delivered: false }

// Feed the same reading for `count` steps; returns the state and every event.
function run(state, reading, count) {
  const events = []
  let current = state
  for (let i = 0; i < count; i += 1) {
    const { event, ...next } = nextPalletState(current, reading, DT)
    if (event) events.push(event)
    current = next
  }
  return { state: current, events }
}

const carried = () => run(initialPalletState(), lifted, steps(PALLET_CONFIRM_SECONDS)).state

test('a pallet on the floor stays on the ground, forks in it or not', () => {
  for (const reading of [onFloor, forksIn]) {
    const { state, events } = run(initialPalletState(), reading, 120)
    assert.equal(state.state, 'ground')
    assert.deepEqual(events, [])
  }
})

test('held by the forks alone, it is lifted, once, after the confirm time', () => {
  const brief = run(initialPalletState(), lifted, 2)
  assert.equal(brief.state.state, 'ground')
  // A bounce: the hold starts again from nothing.
  assert.equal(run(brief.state, forksIn, 1).state.holdTime, 0)

  const { state, events } = run(initialPalletState(), lifted, 120)
  assert.equal(state.state, 'carried')
  assert.deepEqual(events, ['lifted'])
})

test('a carried load lowered onto something is landed while the forks are still under it', () => {
  const landed = run(carried(), forksIn, 30)
  assert.deepEqual([landed.state.state, landed.state.landed], ['carried', true])
  assert.deepEqual(landed.events, [])
  // Raised again, it is simply carried.
  assert.equal(run(landed.state, lifted, 5).state.landed, false)
})

test('set down: off the forks, at rest and level, it is released and can be lifted again', () => {
  const landed = run(carried(), forksIn, 10).state
  const settling = run(landed, onFloor, steps(PALLET_CONFIRM_SECONDS))
  assert.equal(settling.state.state, 'settling')
  const released = run(settling.state, onFloor, steps(PALLET_REST_SECONDS))
  assert.equal(released.state.state, 'released')
  assert.deepEqual(released.events, ['set-down'])

  const again = run(released.state, lifted, steps(PALLET_CONFIRM_SECONDS))
  assert.deepEqual([again.state.state, again.events], ['carried', ['lifted']])
})

test('a load that is not yet level is not released', () => {
  const settling = run(run(carried(), forksIn, 10).state, onFloor, steps(PALLET_CONFIRM_SECONDS)).state
  const leaning = run(settling, { ...onFloor, lean: PALLET_LEVEL_LEAN * 2 }, 120)
  assert.deepEqual([leaning.state.state, leaning.events], ['settling', []])
})

test('a released load where it was going, forks clear, is delivered and stays delivered', () => {
  const released = run(run(run(carried(), forksIn, 10).state, onFloor, steps(PALLET_CONFIRM_SECONDS)).state, onFloor, steps(PALLET_REST_SECONDS)).state
  const delivered = run(released, { ...onFloor, delivered: true }, 3)
  assert.deepEqual([delivered.state.state, delivered.events], ['delivered', ['delivered']])
  // Picking it up again does not undo the delivery.
  assert.deepEqual(run(delivered.state, lifted, 120).events, [])
  assert.equal(run(delivered.state, lifted, 120).state.state, 'delivered')
})

test('a load that leaves the forks with nothing under it is lost when it comes down', () => {
  const falling = run(carried(), inTheAir, steps(PALLET_CONFIRM_SECONDS))
  assert.deepEqual([falling.state.state, falling.events], ['falling', []])
  const down = run(falling.state, { ...onFloor, speed: 0.4, lean: 0.6 }, 1)
  assert.deepEqual([down.state.state, down.events], ['dropped', ['lost']])
})

test('a load that slides off a moving truck is lost, not set down', () => {
  const sliding = { ...onFloor, speed: PALLET_SET_DOWN_SPEED * 2 }
  const off = run(carried(), sliding, steps(PALLET_CONFIRM_SECONDS))
  assert.equal(off.state.state, 'falling')
  assert.deepEqual(run(off.state, sliding, 1).events, ['lost'])
})

test('a load that goes over after being set down is lost', () => {
  const settling = run(run(carried(), forksIn, 10).state, onFloor, steps(PALLET_CONFIRM_SECONDS)).state
  const over = run(settling, { ...onFloor, lean: PALLET_DROP_LEAN * 1.5 }, 1)
  assert.deepEqual([over.state.state, over.events], ['dropped', ['lost']])
})

test('a lost load that came down upright can be picked up again', () => {
  const dropped = run(run(carried(), inTheAir, steps(PALLET_CONFIRM_SECONDS)).state, { ...onFloor, speed: 0.4 }, 1).state
  const rested = run(dropped, onFloor, steps(PALLET_REST_SECONDS))
  assert.deepEqual([rested.state.state, rested.events], ['released', ['set-down']])
  // On its side it stays where it fell.
  const onItsSide = run(dropped, { ...onFloor, lean: 1.5 }, 120)
  assert.deepEqual([onItsSide.state.state, onItsSide.events], ['dropped', []])
})

test('a moment off the forks while carried is not a loss', () => {
  const blip = run(carried(), inTheAir, 2)
  assert.equal(blip.state.state, 'carried')
  assert.equal(run(blip.state, lifted, 1).state.offTime, 0)
})
