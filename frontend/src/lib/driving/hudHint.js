// One short line over the driving HUD's dashboard: how to start, what the
// lever does, how to look around. `hud` is the cockpit snapshot
// (cockpitTelemetry.js) and `t` the caller's translator, so this stays pure.
// Every key is listed in the dashboard's Controls drawer.
export function drivingHint(t, hud, shot) {
  const { engineOn, leverEngaged, shifterActive, needSeatbelt, needParkingBrake, needNeutral } = hud
  const interlockBlocked = needSeatbelt || needParkingBrake || needNeutral
  return [
    !engineOn && t(interlockBlocked ? 'driving.hud.hint.interlock' : 'driving.hud.hint.engineOff'),
    engineOn && leverEngaged && t(shifterActive ? 'driving.hud.hint.shifter' : 'driving.hud.hint.lever'),
    shot === 'first-person' && t('driving.hud.hint.look'),
  ]
    .filter(Boolean)
    .join(' ')
}
