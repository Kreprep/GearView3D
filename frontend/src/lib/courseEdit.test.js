import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { addItem, addTask, listCourseItems, moveTask, removeItem, removeItems, removeTask, taskItemKey, updateTask } from './courseEdit.js'

const base = () => ({
  start: { position: [0, 0, 0], heading: 0 },
  checkpoints: [{ id: 'gate', position: [0, 0, 4] }],
  decorations: [],
  pallets: [
    { id: 'to-rack', position: [0, 0, 6], target: { rack: 'rack-1', level: 'middle' } },
    { id: 'old-rack', position: [1, 0, 6], targetRack: 'rack-1', targetLevel: 'top' },
    { id: 'on-shelf', position: [0, 0, 12], startShelf: { rack: 'rack-1', level: 'top' }, target: { zone: 'dock' } },
  ],
  racks: [{ id: 'rack-1', position: [0, 0, 12] }],
  dropZones: [{ id: 'dock', position: [0, 0, 2], radius: 0.9, label: 'Dock' }],
  dropZone: null,
  parkingBay: { position: [2, 0, 2] },
})

describe('drop zones', () => {
  test('each zone in the list is an item on the map, beside the older single one', () => {
    const items = listCourseItems({ ...base(), dropZone: { position: [3, 0, 3] } })
    assert.deepEqual(items.filter((item) => item.kind === 'dropZone').map((item) => item.key), ['dropZones:0', 'dropZone'])
  })

  test('a placed zone joins the list with an id of its own', () => {
    const data = addItem(addItem({ ...base(), dropZones: [] }, 'dropZone', 1, 1), 'dropZone', 2, 2)
    assert.deepEqual(data.dropZones.map((zone) => [zone.id, zone.label]), [['zone-1', 'Drop Zone 1'], ['zone-2', 'Drop Zone 2']])
  })

  test('next to the older single zone, the numbering goes on from it', () => {
    const data = addItem({ ...base(), dropZones: undefined, dropZone: { position: [0, 0, 1] } }, 'dropZone', 1, 1)
    assert.equal(data.dropZones[0].label, 'Drop Zone 2')
  })

  test('deleting a zone clears the targets that named it', () => {
    const data = removeItem(base(), 'dropZones:0')
    assert.deepEqual(data.dropZones, [])
    assert.equal(data.pallets[2].target, undefined)
  })
})

test('deleting a rack clears every reference to it: target, older target and start shelf', () => {
  const data = removeItems(base(), ['racks:0'])
  assert.equal(data.pallets[0].target, undefined)
  assert.equal(data.pallets[1].targetRack, undefined)
  assert.equal(data.pallets[2].startShelf, undefined)
  // ...but not a target that names something else.
  assert.deepEqual(data.pallets[2].target, { zone: 'dock' })
})

test('the start can be moved but not deleted', () => {
  assert.deepEqual(removeItem(base(), 'start').start, base().start)
})

describe('mission tasks', () => {
  test('add, edit, reorder and remove', () => {
    let data = addTask(addTask(addTask(base(), 'start'), 'checkpoint'), 'park')
    assert.deepEqual(data.tasks.map((task) => [task.id, task.type, task.ref]), [
      ['start-1', 'start', undefined],
      ['checkpoint-2', 'checkpoint', ''],
      ['park-3', 'park', undefined],
    ])
    assert.equal(data.tasks[0].label, 'Start the truck')

    data = updateTask(data, 1, { ref: 'gate', label: 'Through the gate' })
    assert.deepEqual(data.tasks[1], { id: 'checkpoint-2', type: 'checkpoint', ref: 'gate', label: 'Through the gate' })

    data = moveTask(data, 2, -1)
    assert.deepEqual(data.tasks.map((task) => task.type), ['start', 'park', 'checkpoint'])
    assert.equal(moveTask(data, 0, -1), data, 'out of range leaves it as it was')

    data = removeTask(data, 0)
    assert.deepEqual(data.tasks.map((task) => task.type), ['park', 'checkpoint'])
    assert.equal(removeTask(data, 9), data)
  })

  test('a task finds the object it names on the map', () => {
    const data = base()
    assert.equal(taskItemKey(data, { type: 'checkpoint', ref: 'gate' }), 'checkpoints:0')
    assert.equal(taskItemKey(data, { type: 'deliver', ref: 'on-shelf' }), 'pallets:2')
    assert.equal(taskItemKey(data, { type: 'park' }), 'parkingBay')
    assert.equal(taskItemKey(data, { type: 'start' }), null)
    assert.equal(taskItemKey(data, { type: 'deliver', ref: 'gone' }), null)
  })
})
