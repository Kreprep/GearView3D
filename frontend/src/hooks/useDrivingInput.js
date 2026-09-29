import { useEffect, useState } from 'react'
import { createKeyboardSource, DRIVING_KEYS } from '../lib/driving/keyboardSource'

// The keyboard control source for DrivingSimulationViewer: window key events
// into lib/driving/keyboardSource.js, which the frame loop reads each sim
// step. `pressed` only lights up the on-screen key legend.
export function useDrivingInput() {
  const [source] = useState(createKeyboardSource)
  const [pressed, setPressed] = useState(() => Object.fromEntries(DRIVING_KEYS.map((key) => [key, false])))

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!source.keyDown(event.key, event.repeat)) return
      event.preventDefault()
      const key = event.key.toLowerCase()
      setPressed((current) => (current[key] ? current : { ...current, [key]: true }))
    }

    const handleKeyUp = (event) => {
      source.keyUp(event.key)
      const key = event.key.toLowerCase()
      setPressed((current) => (current[key] ? { ...current, [key]: false } : current))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [source])

  return { source, pressed }
}
