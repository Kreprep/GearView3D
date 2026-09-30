// The safety signs over the operator dashboard (components/driving/
// SafetySigns.jsx) and the end-of-attempt summary in the task panel. The rule
// ids are lib/driving/safetyRules.js's: a rule's sign is `safety.sign.<id>`
// and its line in the summary `safety.rule.<id>`.
export default {
  'safety.signs.label': 'Safety signs',
  // What a screen reader announces: the severity, then the sign.
  'safety.sign.announce': '{severity}: {message}',
  'safety.severity.info': 'Notice',
  'safety.severity.caution': 'Caution',
  'safety.severity.danger': 'Danger',

  'safety.sign.obstacle-ahead': 'Obstacle ahead: slow down',
  'safety.sign.obstacle-ahead.stop': 'Stop: obstacle ahead',
  'safety.sign.obstacle-behind': 'Obstacle behind: slow down',
  'safety.sign.obstacle-behind.stop': 'Stop: obstacle behind',
  'safety.sign.tail-swing': 'Watch the tail swing',
  'safety.sign.overload': 'Do not lift: over the rated capacity',
  'safety.sign.tip-risk': 'Tip-over risk: slow down and lower the load',
  'safety.sign.load-shifting': 'The load is shifting: ease off',
  'safety.sign.start-interlock.seatbelt': 'Fasten the seatbelt (B)',
  'safety.sign.start-interlock.parkingBrake': 'Set the parking brake (Space)',
  'safety.sign.start-interlock.neutral': 'Put the direction lever in N',
  'safety.sign.look-direction': 'Look behind you',
  'safety.sign.overspeed': 'Slow down: the limit is {limit} km/h',
  'safety.sign.turn-speed': 'Slow down for the turn',
  'safety.sign.direction-change-moving': 'Stop before changing direction',
  'safety.sign.forks-high-travel': 'Lower the forks for travel',
  'safety.sign.mast-not-back': 'Tilt the mast back',
  'safety.sign.tilt-forward-elevated': 'Do not tilt a raised load forward',
  'safety.sign.lifting-while-moving': 'Do not work the lift while travelling',
  'safety.sign.forks-not-inserted': 'Forks not fully inserted',
  'safety.sign.parking-brake-on': 'Release the parking brake',
  'safety.sign.seatbelt-off': 'Fasten the seatbelt',
  'safety.sign.forks-raised-parked': 'Lower the forks to the ground',
  // A hint, not a fault: it has no line in the summary.
  'safety.sign.release-load': 'Tilt the mast forward to set the load down',

  // The end-of-attempt summary: "3 safety signs on this attempt: travelled
  // with the forks raised, went over the speed limit (x2)."
  'safety.summary.clean': 'Clean run: no safety signs on this attempt.',
  'safety.summary.signs.one': '{count} safety sign on this attempt: {list}.',
  'safety.summary.signs.other': '{count} safety signs on this attempt: {list}.',
  'safety.summary.repeated': '{rule} (×{times})',
  'safety.summary.fails.one': '{count} failed attempt before it.',
  'safety.summary.fails.other': '{count} failed attempts before it.',

  'safety.rule.obstacle-ahead': 'closed on an obstacle ahead',
  'safety.rule.obstacle-behind': 'closed on an obstacle behind',
  'safety.rule.tail-swing': 'swung the tail near an obstacle',
  'safety.rule.overload': 'tried a load over the rated capacity',
  'safety.rule.tip-risk': 'came close to tipping over',
  'safety.rule.load-shifting': 'let the load shift on the forks',
  'safety.rule.start-interlock': 'tried to start before the start checks',
  'safety.rule.look-direction': 'reversed without looking behind',
  'safety.rule.overspeed': 'went over the speed limit',
  'safety.rule.turn-speed': 'turned too fast',
  'safety.rule.direction-change-moving': 'changed direction while moving',
  'safety.rule.forks-high-travel': 'travelled with the forks raised',
  'safety.rule.mast-not-back': 'carried a load with the mast not tilted back',
  'safety.rule.tilt-forward-elevated': 'tilted a raised load forward',
  'safety.rule.lifting-while-moving': 'worked the lift while travelling',
  'safety.rule.forks-not-inserted': 'lifted with the forks partly inserted',
  'safety.rule.parking-brake-on': 'drove against the parking brake',
  'safety.rule.seatbelt-off': 'unfastened the seatbelt with the engine running',
  'safety.rule.forks-raised-parked': 'left the forks raised when parked',
}
