import { parseGamepadId } from './gamepad.js'

// The browser half of the Gamepad API: navigator.getGamepads() as plain pad
// snapshots ({ key, name, index, axes, buttons }) for the pure code in
// gamepad.js and wheelSource.js.
//
// Gamepads only appear after a button press while the page has focus (a
// browser privacy rule), and the API needs a secure context (localhost and
// the HTTPS live instance both are). A Permissions Policy can block it, in
// which case getGamepads() throws and there are simply no pads.

export function gamepadsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
}

export function snapshotGamepads() {
  if (!gamepadsSupported()) return []
  let gamepads
  try {
    gamepads = navigator.getGamepads()
  } catch {
    return []
  }
  const pads = []
  for (const gamepad of gamepads) {
    if (!gamepad || !gamepad.connected) continue
    pads.push({
      key: parseGamepadId(gamepad.id).key,
      name: gamepad.id,
      index: gamepad.index,
      axes: Array.from(gamepad.axes),
      buttons: Array.from(gamepad.buttons, (button) => (button.pressed ? Math.max(button.value, 1) : button.value)),
    })
  }
  return pads
}

// Calls `onChange` when a pad connects or disconnects. Returns the
// unsubscribe function.
export function subscribeToGamepads(onChange) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('gamepadconnected', onChange)
  window.addEventListener('gamepaddisconnected', onChange)
  return () => {
    window.removeEventListener('gamepadconnected', onChange)
    window.removeEventListener('gamepaddisconnected', onChange)
  }
}
