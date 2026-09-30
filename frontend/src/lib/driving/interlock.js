// The pre-start interlock (docs/revisions/post-defense-plan.md, section 4.2):
// the engine only cranks with the seatbelt fastened, the parking brake set
// and the direction lever in N - the operator-presence and neutral-start
// interlocks an IC counterbalance truck has. Pure.
//
// With the keyboard's automatic direction the lever reads N at rest, so only
// holding W or S while turning the key trips the neutral check. A shifter has
// to physically be in neutral.

// In the order the learner should work through them.
export const INTERLOCK_ITEMS = ['seatbelt', 'parkingBrake', 'neutral']

// The items the controls don't satisfy, in INTERLOCK_ITEMS order. Empty when
// the engine may start.
export function startInterlockMissing(controls) {
  const missing = []
  if (!controls.seatbelt) missing.push('seatbelt')
  if (!controls.parkingBrake) missing.push('parkingBrake')
  if (controls.direction !== 'N') missing.push('neutral')
  return missing
}
