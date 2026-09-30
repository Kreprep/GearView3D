// A pallet's state, derived from what the physics reads off it (docs/
// revisions/post-defense-plan.md, section 4.6). Pure: one pallet's state and
// timers and this step's reading in, the next state and what happened out.
//
//   ground     where the course put it, never lifted
//   carried    on the forks. `landed` while something else holds it up as
//              well: it has been lowered onto the floor or a shelf and the
//              forks are still under it
//   settling   off the forks, set down, not yet at rest
//   released   set down, at rest and level: it can be picked up again
//   delivered  released where it was going, with the forks withdrawn
//   falling    left the forks with nothing under it, or while still moving
//   dropped    came down from that: a lost load
//
// The reading:
//   onForks    touching a tine or the load backrest
//   supported  resting on the floor, a shelf or another load
//   speed      scene units per second
//   lean       radians off level
//   delivered  at its destination with the forks clear (the caller's test)
//
// What happened is one of PALLET_EVENTS or null. lib/driving/stepPallet.js
// turns 'lifted', 'set-down' and 'delivered' into the viewer's pallet-lifted /
// pallet-dropped / pallet-delivered events, which are unchanged.
import {
  PALLET_CONFIRM_SECONDS,
  PALLET_DROP_LEAN,
  PALLET_LEVEL_LEAN,
  PALLET_REST_SECONDS,
  PALLET_REST_SPEED,
  PALLET_SET_DOWN_SPEED,
} from '../../data/palletProfile.js'

export const PALLET_EVENTS = ['lifted', 'set-down', 'delivered', 'lost']

export function initialPalletState() {
  return { state: 'ground', landed: false, holdTime: 0, offTime: 0, restTime: 0 }
}

const enter = (state, event = null) => ({ state, event, landed: false, holdTime: 0, offTime: 0, restTime: 0 })

export function nextPalletState(current, reading, dt) {
  const { onForks, supported, speed, lean } = reading
  const resting = supported && speed <= PALLET_REST_SPEED
  const restTime = resting ? current.restTime + dt : 0
  const same = { state: current.state, event: null, landed: false, holdTime: 0, offTime: 0, restTime }
  const atRestLevel = restTime >= PALLET_REST_SECONDS && lean <= PALLET_LEVEL_LEAN

  switch (current.state) {
    case 'ground':
    case 'released': {
      // Held up by the forks alone, for long enough not to be a bounce.
      const holdTime = onForks && !supported ? current.holdTime + dt : 0
      if (holdTime >= PALLET_CONFIRM_SECONDS) return enter('carried', 'lifted')
      if (current.state === 'released' && reading.delivered) return enter('delivered', 'delivered')
      return { ...same, holdTime }
    }

    case 'carried': {
      if (onForks) return { ...same, landed: supported }
      const offTime = current.offTime + dt
      if (offTime < PALLET_CONFIRM_SECONDS) return { ...same, landed: current.landed, offTime }
      // Off the forks. Set down means: something under it, hardly moving,
      // upright.
      const setDown = supported && speed <= PALLET_SET_DOWN_SPEED && lean <= PALLET_DROP_LEAN
      return enter(setDown ? 'settling' : 'falling')
    }

    case 'settling':
      if (onForks && !supported) return enter('carried')
      if (speed > PALLET_SET_DOWN_SPEED || lean > PALLET_DROP_LEAN) return enter('dropped', 'lost')
      return atRestLevel ? enter('released', 'set-down') : same

    case 'falling':
      return supported ? enter('dropped', 'lost') : same

    case 'dropped':
      // A load that came down upright can be picked up again (where a lost
      // load does not fail the attempt).
      return atRestLevel ? enter('released', 'set-down') : same

    // A delivered load stays delivered: the step is complete.
    default:
      return same
  }
}
