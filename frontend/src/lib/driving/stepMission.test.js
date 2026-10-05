import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepMission } from './stepMission.js'

// The mission's order rule (module improvements Phase 5, decided 2026-10-05):
// tasks complete in order; a checkpoint counts only while it is the active
// task; a task that is a state of the course and already holds when it
// becomes active completes at once. The drives are in physicsScenarios.test.js;
// these pin the rule on a hand-built state.

const checkpoint = { id: 'gate', type: 'pass', position: [0, 0, 5], radius: 1 }

function missionState({ tasks, truck = {}, pallets = [], parked = false }) {
  const state = {
    time: 0,
    failed: false,
    truck: { x: 0, z: 0, speed: 0, engineOn: true, ...truck },
    frame: { controlsLocked: false },
    horn: { at: null, x: 0, z: 0 },
    pallets: pallets.map(([id, palletState]) => ({ def: { id }, state: palletState })),
    parking: { parked },
    mission: { index: 0, since: 0 },
    events: [],
  }
  const world = { checkpoints: [checkpoint], mission: tasks }
  return { state, world }
}

const done = (state) => state.events.map((event) => event.task.id)

test('a later delivery done early completes as soon as its turn comes', () => {
  const tasks = [
    { id: 'first', type: 'deliver', ref: 'a' },
    { id: 'second', type: 'deliver', ref: 'b' },
  ]
  const { state, world } = missionState({ tasks, pallets: [['a', 'carried'], ['b', 'delivered']] })
  stepMission(state, world)
  assert.deepEqual(done(state), [])

  state.pallets[0].state = 'delivered'
  stepMission(state, world)
  assert.deepEqual(done(state), ['first', 'second'])
  assert.deepEqual(state.events.map((event) => event.isLast), [false, true])
})

test('a checkpoint passed before its turn does not count', () => {
  const tasks = [
    { id: 'deliver', type: 'deliver', ref: 'a' },
    { id: 'gate', type: 'checkpoint', ref: 'gate' },
  ]
  const { state, world } = missionState({ tasks, truck: { z: 5 }, pallets: [['a', 'ground']] })
  stepMission(state, world)
  assert.deepEqual(done(state), [])

  // Delivered, and the truck has driven on: the gate is the task now, and
  // only counts once the truck is in it.
  state.pallets[0].state = 'delivered'
  state.truck.z = 0
  stepMission(state, world)
  assert.deepEqual(done(state), ['deliver'])
  state.truck.z = 5
  stepMission(state, world)
  assert.deepEqual(done(state), ['deliver', 'gate'])
})

test('nothing completes once the attempt has failed, or with no mission', () => {
  const { state, world } = missionState({ tasks: [{ id: 'start', type: 'start' }] })
  state.failed = true
  stepMission(state, world)
  assert.deepEqual(state.events, [])

  state.failed = false
  state.mission = null
  stepMission(state, world)
  assert.deepEqual(state.events, [])
})

test('start and park read the engine and the parked latch', () => {
  const tasks = [
    { id: 'start', type: 'start' },
    { id: 'park', type: 'park' },
  ]
  const { state, world } = missionState({ tasks, truck: { engineOn: false } })
  stepMission(state, world)
  assert.deepEqual(done(state), [])
  state.truck.engineOn = true
  stepMission(state, world)
  assert.deepEqual(done(state), ['start'])
  state.parking.parked = true
  stepMission(state, world)
  assert.deepEqual(done(state), ['start', 'park'])
  assert.equal(state.mission.index, 2)
})
