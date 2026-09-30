import {
  CREEP_SPEED,
  FORKS_TRAVEL_HEIGHT,
  OBSTACLE_CAUTION_SECONDS,
  OBSTACLE_DANGER_SECONDS,
  OBSTACLE_MIN_SPEED,
  PARKED_FORKS_MAX,
  PARKING_BRAKE_THROTTLE,
  TAIL_SWING_MIN_STEER,
  TAIL_SWING_REACH,
  TILT_FORWARD_ANGLE,
  TURN_MAX_STEER,
  TURN_MAX_STEER_RATE,
  TURN_SPEED,
} from '../../data/safetyThresholds.js'
import { TILT_RELEASE_ANGLE } from '../../data/palletProfile.js'
import { TILT_SECURE_ANGLE } from './constants.js'

// The driving simulation's safety rules (docs/revisions/post-defense-plan.md,
// section 4.5), and the queue that turns them into signs. Pure: the rules read
// a snapshot (safetySnapshot.js) and never the simulation itself, so they
// cannot change it, and everything here runs under node --test.
//
// A rule is { id, severity, kind, pictogram, messageKey, sound, osha, when }:
//   severity   'info' | 'caution' | 'danger': how urgent, and which chime
//   kind       the sign's ISO 7010 family: 'warning' (yellow triangle),
//              'mandatory' (blue circle), 'prohibition' (red circle)
//   pictogram  a name in components/driving/SafetySigns.jsx
//   messageKey an i18n key (i18n/*/safety.js)
//   sound      a data/soundBank.js one-shot, or null
//   osha       the 29 CFR 1910.178 paragraph it implements, or the operator's
//              manual. The thresholds are GearView defaults
//              (data/safetyThresholds.js); OSHA gives no numbers.
//   when(snapshot)  false, true, or an object overriding any of severity,
//              kind, pictogram, messageKey, sound and giving the message's
//              `values`
//   hint       true for a sign that only says what to do next. It is shown
//              like any other but is not a violation, so it is not logged.
//
// Which rules a course may switch off is lib/courseAlerts.js, which lists the
// same ids. tip-risk and load-shifting arrive in Phase 7.

const CAUTION = { severity: 'caution', sound: 'cautionChime' }
const DANGER = { severity: 'danger', sound: 'dangerAlarm' }
const INFO = { severity: 'info', sound: null }

// Time to reach what is in the truck's path at its present speed. Under the
// danger time the warning becomes a stop sign.
function obstacleRule(id, side, moving) {
  return {
    id,
    ...CAUTION,
    kind: 'warning',
    pictogram: 'obstacle',
    messageKey: `safety.sign.${id}`,
    osha: '(n)(8)',
    when(s) {
      const speed = moving(s)
      if (speed <= OBSTACLE_MIN_SPEED || s[side] == null) return false
      const seconds = s[side] / speed
      if (seconds < OBSTACLE_DANGER_SECONDS) {
        return { ...DANGER, kind: 'prohibition', pictogram: 'stop', messageKey: `safety.sign.${id}.stop` }
      }
      return seconds < OBSTACLE_CAUTION_SECONDS
    },
  }
}

const travelling = (s) => Math.abs(s.speed) > CREEP_SPEED
const within = (distance, reach) => distance != null && distance <= reach
const raisedLoad = (s) => s.carrying && !s.loadLanded

const INTERLOCK_PICTOGRAMS = { seatbelt: 'seatbelt', parkingBrake: 'parking-brake', neutral: 'neutral' }

export const SAFETY_RULES = [
  obstacleRule('obstacle-ahead', 'ahead', (s) => s.speed),
  obstacleRule('obstacle-behind', 'behind', (s) => -s.speed),
  {
    // A rear-steer truck's tail swings to the outside of the turn: to the
    // right turning left (yaw +1), to the left turning right.
    id: 'tail-swing',
    ...CAUTION,
    kind: 'warning',
    pictogram: 'tail-swing',
    messageKey: 'safety.sign.tail-swing',
    osha: '(n)(15)',
    when: (s) =>
      travelling(s) && s.steer >= TAIL_SWING_MIN_STEER && s.yaw !== 0 && within(s.yaw > 0 ? s.rearRight : s.rearLeft, TAIL_SWING_REACH),
  },
  {
    id: 'overload',
    ...DANGER,
    kind: 'prohibition',
    pictogram: 'overload',
    messageKey: 'safety.sign.overload',
    osha: '(o)(2)',
    when: (s) => s.overCapacity,
  },
  {
    // One sign at a time, in the order the learner should work through them.
    id: 'start-interlock',
    ...INFO,
    kind: 'mandatory',
    pictogram: 'seatbelt',
    messageKey: 'safety.sign.start-interlock.seatbelt',
    osha: "(m)(5), operator's manual",
    when(s) {
      const [item] = s.interlockMissing
      if (!item) return false
      return { pictogram: INTERLOCK_PICTOGRAMS[item], messageKey: `safety.sign.start-interlock.${item}` }
    },
  },
  {
    id: 'look-direction',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'look-behind',
    messageKey: 'safety.sign.look-direction',
    osha: '(n)(6)',
    when: (s) => s.speed < -CREEP_SPEED && s.lookingAhead === true,
  },
  {
    id: 'overspeed',
    ...CAUTION,
    kind: 'prohibition',
    pictogram: 'speed-limit',
    messageKey: 'safety.sign.overspeed',
    osha: '(n)(1)',
    when: (s) => Math.abs(s.speed) > s.speedLimit && { values: { limit: s.speedLimitKmh } },
  },
  {
    id: 'turn-speed',
    ...CAUTION,
    kind: 'warning',
    pictogram: 'turn',
    messageKey: 'safety.sign.turn-speed',
    osha: '(n)(15)',
    when: (s) => Math.abs(s.speed) > TURN_SPEED && (s.steer > TURN_MAX_STEER || s.steerRate > TURN_MAX_STEER_RATE),
  },
  {
    // Only a lever can be shuttled. The keyboard's automatic direction has no
    // other way to stop a reversing truck than W, so it does not count.
    id: 'direction-change-moving',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'direction',
    messageKey: 'safety.sign.direction-change-moving',
    osha: '(n)(8), (n)(9)',
    when: (s) => (s.lever === 'R' && s.speed > CREEP_SPEED) || (s.lever === 'F' && s.speed < -CREEP_SPEED),
  },
  {
    // Laden or not. In a rack's bay the forks have to be up: storing a load,
    // and backing out from under it.
    id: 'forks-high-travel',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'forks-low',
    messageKey: 'safety.sign.forks-high-travel',
    osha: '(n)(7)(iii)',
    when: (s) => travelling(s) && s.forkHeight > FORKS_TRAVEL_HEIGHT && !s.atStack,
  },
  {
    id: 'mast-not-back',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'mast-back',
    messageKey: 'safety.sign.mast-not-back',
    osha: '(o)(5), (n)(7)(iii)',
    when: (s) => raisedLoad(s) && travelling(s) && s.mastTilt > TILT_SECURE_ANGLE,
  },
  {
    id: 'tilt-forward-elevated',
    ...DANGER,
    kind: 'prohibition',
    pictogram: 'tilt-forward',
    messageKey: 'safety.sign.tilt-forward-elevated',
    osha: '(o)(6)',
    when: (s) => raisedLoad(s) && !s.atStack && s.forkHeight > FORKS_TRAVEL_HEIGHT && s.mastTilt >= TILT_FORWARD_ANGLE,
  },
  {
    id: 'lifting-while-moving',
    ...CAUTION,
    kind: 'prohibition',
    pictogram: 'lift',
    messageKey: 'safety.sign.lifting-while-moving',
    osha: '(o)(6)',
    when: (s) => s.engineOn && travelling(s) && s.lift !== 0,
  },
  {
    id: 'forks-not-inserted',
    ...CAUTION,
    kind: 'warning',
    pictogram: 'forks-insert',
    messageKey: 'safety.sign.forks-not-inserted',
    osha: '(o)(5)',
    when: (s) => s.engineOn && s.lift > 0 && (s.grip === 'shallow' || s.grip === 'partial'),
  },
  {
    id: 'parking-brake-on',
    ...INFO,
    kind: 'mandatory',
    pictogram: 'parking-brake',
    messageKey: 'safety.sign.parking-brake-on',
    osha: "operator's manual",
    when: (s) => s.engineOn && s.parkingBrake && s.throttle > PARKING_BRAKE_THROTTLE,
  },
  {
    id: 'seatbelt-off',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'seatbelt',
    messageKey: 'safety.sign.seatbelt-off',
    osha: "operator's manual",
    when: (s) => s.engineOn && !s.seatbelt,
  },
  {
    id: 'forks-raised-parked',
    ...CAUTION,
    kind: 'mandatory',
    pictogram: 'forks-low',
    messageKey: 'safety.sign.forks-raised-parked',
    osha: '(m)(5)(i)',
    when: (s) => (!s.engineOn || s.parkingBrake) && s.forkHeight > PARKED_FORKS_MAX,
  },
  {
    // The second move of setting a load down: it is resting in the drop zone
    // or on its shelf, and comes off the tines once the mast tilts forward.
    id: 'release-load',
    ...INFO,
    hint: true,
    kind: 'mandatory',
    pictogram: 'tilt-forward',
    messageKey: 'safety.sign.release-load',
    osha: '(o)(6)',
    when: (s) => s.loadAtDestination && s.mastTilt < TILT_RELEASE_ANGLE,
  },
]

const NO_VALUES = Object.freeze({})

// The alerts whose rule holds for this snapshot, in rule order. `enabled` is
// lib/courseAlerts.js's resolveAlerts(course). Nothing holds once the attempt
// has failed: it is over, and the fail overlay says why.
export function activeAlerts(snapshot, enabled) {
  if (!snapshot.live) return []
  const alerts = []
  for (const rule of SAFETY_RULES) {
    if (!enabled[rule.id]) continue
    const result = rule.when(snapshot)
    if (!result) continue
    const { id, severity, kind, pictogram, messageKey, sound, hint = false } = rule
    alerts.push({ id, severity, kind, pictogram, messageKey, sound, hint, values: NO_VALUES, ...(result === true ? null : result) })
  }
  return alerts
}

// --- The alert queue ---------------------------------------------------------
//
// Rules switch on and off from one step to the next; signs must not. The
// queue is a reducer over time: stepAlertQueue(queue, active, time) returns
// the next queue, with
//   shown   the signs to draw: most severe first, at most ALERT_MAX_SHOWN
//   edges   what began this step, for the chime and the violation log:
//           { id, severity, sound, escalation, hint }. A sign coming up is one
//           edge; a sign already up that rises to danger is another, marked
//           `escalation`. A `hint` edge is not a violation.
//
// A rule has to hold for ALERT_SHOW_AFTER before its sign comes up, and its
// sign stays for ALERT_CLEAR_AFTER after the rule stops holding. A sign steps
// up to a more severe form at once, and back down only after the same
// ALERT_CLEAR_AFTER. A sign that is up keeps the very same alert object from
// step to step until what it says changes, so `shown` can be compared by
// identity.

export const ALERT_SHOW_AFTER = 0.15
export const ALERT_CLEAR_AFTER = 0.5
export const ALERT_MAX_SHOWN = 2

const SEVERITY_RANK = { info: 0, caution: 1, danger: 2 }
const NO_ALERTS = Object.freeze([])

export function createAlertQueue() {
  return { entries: NO_ALERTS, shown: NO_ALERTS, edges: NO_ALERTS }
}

const sameValues = (a, b) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
}

const sameAlert = (a, b) =>
  a.severity === b.severity && a.kind === b.kind && a.pictogram === b.pictogram && a.messageKey === b.messageKey && sameValues(a.values, b.values)

const edgeOf = (alert, escalation) => ({
  id: alert.id,
  severity: alert.severity,
  sound: alert.sound,
  escalation,
  hint: Boolean(alert.hint),
})

// An entry is one rule's place in the queue: { id, alert, since, lastActive,
// shownAt, levelAt }. `shownAt` is null until the sign comes up; `levelAt` is
// when the rule last held at the severity the sign shows.
function stepEntry(entry, alert, time, edges) {
  if (!alert) {
    // A rule that stopped before its sign came up never shows at all.
    if (entry.shownAt === null || time - entry.lastActive >= ALERT_CLEAR_AFTER) return null
    return entry
  }

  if (entry.shownAt === null) {
    if (time - entry.since < ALERT_SHOW_AFTER) return { ...entry, alert, lastActive: time }
    edges.push(edgeOf(alert, false))
    return { ...entry, alert, lastActive: time, shownAt: time, levelAt: time }
  }

  const step = SEVERITY_RANK[alert.severity] - SEVERITY_RANK[entry.alert.severity]
  if (step > 0) {
    if (alert.severity === 'danger') edges.push(edgeOf(alert, true))
    return { ...entry, alert, lastActive: time, levelAt: time }
  }
  if (step < 0) {
    if (time - entry.levelAt < ALERT_CLEAR_AFTER) return { ...entry, lastActive: time }
    return { ...entry, alert, lastActive: time, levelAt: time }
  }
  return { ...entry, alert: sameAlert(entry.alert, alert) ? entry.alert : alert, lastActive: time, levelAt: time }
}

export function stepAlertQueue(queue, active, time) {
  const edges = []
  const entries = []
  const known = new Set()

  for (const entry of queue.entries) {
    known.add(entry.id)
    const next = stepEntry(entry, active.find((alert) => alert.id === entry.id), time, edges)
    if (next) entries.push(next)
  }
  for (const alert of active) {
    if (known.has(alert.id)) continue
    const next = stepEntry({ id: alert.id, alert, since: time, lastActive: time, shownAt: null, levelAt: null }, alert, time, edges)
    entries.push(next)
  }

  const shown = entries
    .filter((entry) => entry.shownAt !== null)
    .sort((a, b) => SEVERITY_RANK[b.alert.severity] - SEVERITY_RANK[a.alert.severity] || a.shownAt - b.shownAt)
    .slice(0, ALERT_MAX_SHOWN)
    .map((entry) => entry.alert)
  const unchanged = shown.length === queue.shown.length && shown.every((alert, index) => alert === queue.shown[index])

  return {
    entries,
    shown: unchanged ? queue.shown : shown,
    edges: edges.length ? edges : NO_ALERTS,
  }
}
