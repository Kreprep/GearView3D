import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAMERA_MODES, cameraPose, DEFAULT_CAMERA_MODE, FIRST_PERSON_PITCH, nextCameraMode } from './cameraModes.js'

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
const closeVec = (actual, expected) => actual.forEach((value, index) => close(value, expected[index]))

const poseAt = (x, z, heading) => ({ x, y: 0, z, forwardX: Math.sin(heading), forwardZ: Math.cos(heading) })
const view = { forkHeight: 0.3, seatOffset: [0, 0.4, -0.15], lookYaw: 0, lookPitch: 0 }

test('first-person is the default and cycling visits every mode once', () => {
  assert.equal(DEFAULT_CAMERA_MODE, 'first-person')
  let mode = DEFAULT_CAMERA_MODE
  const seen = []
  for (let i = 0; i < CAMERA_MODES.length; i += 1) {
    seen.push(mode)
    mode = nextCameraMode(mode)
  }
  assert.deepEqual(seen, CAMERA_MODES)
  assert.equal(mode, DEFAULT_CAMERA_MODE)
})

test('first-person sits on the seat and looks where the truck faces, a little down', () => {
  // Facing +X: the seat's -0.15 back offset lands at x - 0.15.
  const { position, target } = cameraPose('first-person', poseAt(1, 2, Math.PI / 2), view)
  closeVec(position, [0.85, 0.4, 2])
  closeVec(target, [0.85 + 5 * Math.cos(FIRST_PERSON_PITCH), 0.4 + 5 * Math.sin(FIRST_PERSON_PITCH), 2])
  assert.ok(FIRST_PERSON_PITCH < 0)
})

test('first-person look-around turns the view left for a positive yaw', () => {
  const { position, target } = cameraPose('first-person', poseAt(0, 0, 0), { ...view, lookYaw: Math.PI / 2 })
  // Heading 0 faces +Z; the operator's left is +X.
  close(target[0] - position[0], 5 * Math.cos(FIRST_PERSON_PITCH))
  close(target[2] - position[2], 0)
})

test('top looks straight down with the truck forward as screen-up', () => {
  // Facing +X: the camera is a hair behind (-X) the point it looks down at,
  // which puts +X at the top of the screen.
  const { position, target } = cameraPose('top', poseAt(0, 0, Math.PI / 2), view)
  const drop = position[1] - target[1]
  assert.ok(drop > 3)
  assert.ok(target[0] - position[0] > 0 && target[0] - position[0] < drop * 0.01)
  close(position[2], target[2])
})

test('side views the forks from the operator’s left at fork height', () => {
  const { position, target } = cameraPose('side', poseAt(0, 0, 0), view)
  assert.ok(position[0] > 1, 'camera is on +X, the left at heading 0')
  close(position[2], target[2])
  assert.ok(Math.abs(position[1] - target[1]) < 0.2)
  assert.ok(target[1] > view.forkHeight)
})

test('front sits ahead of the forks and looks back at them', () => {
  const { position, target } = cameraPose('front', poseAt(0, 0, 0), view)
  assert.ok(position[2] > target[2] + 1)
  close(position[0], target[0])
})

test('chase sits behind and above the truck', () => {
  const { position, target } = cameraPose('chase', poseAt(0, 0, 0), view)
  assert.ok(position[2] < -2)
  assert.ok(position[1] > target[1])
})

test('the free camera has no computed pose', () => {
  assert.equal(cameraPose('free', poseAt(0, 0, 0), view), null)
})
