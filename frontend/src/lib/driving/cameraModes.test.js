import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cameraPose, cameraReducer, cameraShot, DEFAULT_CAMERA_VIEW, FIRST_PERSON_PITCH, GLANCE_YAW, glanceTargetYaw, initialCameraState } from './cameraModes.js'

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
const closeVec = (actual, expected) => actual.forEach((value, index) => close(value, expected[index]))

const poseAt = (x, z, heading) => ({ x, y: 0, z, forwardX: Math.sin(heading), forwardZ: Math.cos(heading) })
const view = { forkHeight: 0.3, seatOffset: [0, 0.4, -0.15], lookYaw: 0, lookPitch: 0 }

// Apply commands in order from the initial state.
const run = (...commands) => commands.reduce(cameraReducer, initialCameraState())
const chase = (...commands) => run('cameraToggle', ...commands)

// --- the state machine ----------------------------------------------------------

test('first-person is the default; C toggles to chase and back', () => {
  assert.equal(DEFAULT_CAMERA_VIEW, 'first-person')
  assert.equal(cameraShot(run()), 'first-person')
  assert.equal(cameraShot(run('cameraToggle')), 'behind')
  assert.equal(cameraShot(run('cameraToggle', 'cameraToggle')), 'first-person')
})

test('chase: left steps round the truck in four stops and comes back behind', () => {
  assert.deepEqual(
    [chase('cameraLeft'), chase('cameraLeft', 'cameraLeft'), chase('cameraLeft', 'cameraLeft', 'cameraLeft')].map(cameraShot),
    ['left', 'front', 'right'],
  )
  assert.equal(cameraShot(chase('cameraLeft', 'cameraLeft', 'cameraLeft', 'cameraLeft')), 'behind')
  // Right goes the other way round.
  assert.equal(cameraShot(chase('cameraRight')), 'right')
  assert.equal(cameraShot(chase('cameraLeft', 'cameraRight')), 'behind')
})

test('chase: up goes overhead, up again or down comes back, and down never goes below ground', () => {
  assert.equal(cameraShot(chase('cameraUp')), 'overhead')
  assert.equal(cameraShot(chase('cameraUp', 'cameraUp')), 'behind')
  assert.equal(cameraShot(chase('cameraUp', 'cameraDown')), 'behind')
  const level = chase()
  assert.equal(cameraReducer(level, 'cameraDown'), level)
})

test('chase: left and right still step the orbit overhead, so coming down lands on the new stop', () => {
  const overhead = chase('cameraUp', 'cameraLeft')
  assert.equal(cameraShot(overhead), 'overhead')
  assert.equal(cameraShot(cameraReducer(overhead, 'cameraDown')), 'left')
})

test('first-person: left and right glance round a ring and never leave the seat', () => {
  const glances = (...commands) => {
    const state = run(...commands)
    assert.equal(cameraShot(state), 'first-person')
    return state.glance
  }
  assert.deepEqual(
    [glances('cameraLeft'), glances('cameraLeft', 'cameraLeft'), glances('cameraLeft', 'cameraLeft', 'cameraLeft'), glances('cameraLeft', 'cameraLeft', 'cameraLeft', 'cameraLeft')],
    ['left', 'behind', 'right', 'ahead'],
  )
  assert.equal(glances('cameraRight'), 'right')
  assert.equal(glances('cameraRight', 'cameraRight'), 'behind')
  // Down looks behind and up looks ahead from anywhere on the ring.
  assert.equal(glances('cameraLeft', 'cameraDown'), 'behind')
  assert.equal(glances('cameraLeft', 'cameraLeft', 'cameraUp'), 'ahead')
  // A repeated glance still counts, so it re-applies after a drag.
  assert.equal(run('cameraUp', 'cameraUp').glanceCount, 2)
})

test('side glances are 60 degrees; the eased target keeps turning the way pressed', () => {
  close(GLANCE_YAW.left, Math.PI / 3)
  close(GLANCE_YAW.right, -Math.PI / 3)
  // Left from behind carries on past 180 to 300 degrees, not back through 0.
  close(glanceTargetYaw('right', Math.PI), (5 * Math.PI) / 3)
  // And from a look already wound round once, it stays on that turn.
  close(glanceTargetYaw('left', 2 * Math.PI), 2 * Math.PI + Math.PI / 3)
})

test('the chase stop is remembered across a trip to first-person', () => {
  const state = chase('cameraLeft', 'cameraToggle', 'cameraToggle')
  assert.equal(cameraShot(state), 'left')
})

test('views can be picked outright, including the admin free camera', () => {
  assert.equal(cameraShot(run('view:chase')), 'behind')
  assert.equal(cameraShot(run('view:free')), 'free')
  const state = run()
  assert.equal(cameraReducer(state, 'view:top'), state, 'not a view')
  assert.equal(cameraReducer(state, 'cameraNext'), state, 'not a command')
})

// --- poses -----------------------------------------------------------------------

test('first-person sits on the seat and looks where the truck faces, a little down', () => {
  // Facing +X: the seat's -0.15 back offset lands at x - 0.15.
  const { position, target } = cameraPose(run(), poseAt(1, 2, Math.PI / 2), view)
  closeVec(position, [0.85, 0.4, 2])
  closeVec(target, [0.85 + 5 * Math.cos(FIRST_PERSON_PITCH), 0.4 + 5 * Math.sin(FIRST_PERSON_PITCH), 2])
  assert.ok(FIRST_PERSON_PITCH < 0)
})

test('first-person look-around turns the view left for a positive yaw', () => {
  const { position, target } = cameraPose(run(), poseAt(0, 0, 0), { ...view, lookYaw: Math.PI / 2 })
  // Heading 0 faces +Z; the operator's left is +X.
  close(target[0] - position[0], 5 * Math.cos(FIRST_PERSON_PITCH))
  close(target[2] - position[2], 0)
})

test('overhead looks straight down with the truck forward as screen-up', () => {
  // Facing +X: the camera is a hair behind (-X) the point it looks down at,
  // which puts +X at the top of the screen.
  const { position, target } = cameraPose(chase('cameraUp'), poseAt(0, 0, Math.PI / 2), view)
  const drop = position[1] - target[1]
  assert.ok(drop > 3)
  assert.ok(target[0] - position[0] > 0 && target[0] - position[0] < drop * 0.01)
  close(position[2], target[2])
})

test('the side stops view the forks from the operator’s left and right at fork height', () => {
  const left = cameraPose(chase('cameraLeft'), poseAt(0, 0, 0), view)
  assert.ok(left.position[0] > 1, 'camera is on +X, the left at heading 0')
  close(left.position[2], left.target[2])
  assert.ok(Math.abs(left.position[1] - left.target[1]) < 0.2)
  assert.ok(left.target[1] > view.forkHeight)
  const right = cameraPose(chase('cameraRight'), poseAt(0, 0, 0), view)
  close(right.position[0], -left.position[0])
  closeVec(right.target, left.target)
})

test('the front stop sits ahead of the forks and looks back at them', () => {
  const { position, target } = cameraPose(chase('cameraLeft', 'cameraLeft'), poseAt(0, 0, 0), view)
  assert.ok(position[2] > target[2] + 1)
  close(position[0], target[0])
})

test('chase behind sits behind and above the truck', () => {
  const { position, target } = cameraPose(chase(), poseAt(0, 0, 0), view)
  assert.ok(position[2] < -2)
  assert.ok(position[1] > target[1])
})

test('the free camera has no computed pose', () => {
  assert.equal(cameraPose(run('view:free'), poseAt(0, 0, 0), view), null)
})
