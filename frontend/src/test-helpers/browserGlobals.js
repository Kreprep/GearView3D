// Minimal browser-global shim so lib modules that read localStorage/window at
// import time (progressService.js) can be imported under plain Node's test
// runner, which has neither. Import this before importing the module under
// test - ESM evaluates sibling imports in source order, so it runs first.
const store = new Map()

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
}

globalThis.window = globalThis
globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type
  }
}
globalThis.window.dispatchEvent = () => {}
globalThis.window.addEventListener = () => {}
globalThis.window.removeEventListener = () => {}
