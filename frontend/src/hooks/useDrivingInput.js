import { useEffect, useRef, useState } from 'react'

export function useDrivingInput(onEngineToggle, onKeyActive) {
  const keysRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    raise: false,
    lower: false,
    tiltBack: false,
    tiltForward: false,
  })
  const [pressed, setPressed] = useState({ w: false, a: false, s: false, d: false, e: false, r: false, f: false, t: false, g: false })
  const onEngineToggleRef = useRef(onEngineToggle)
  const onKeyActiveRef = useRef(onKeyActive)

  useEffect(() => {
    onEngineToggleRef.current = onEngineToggle
  }, [onEngineToggle])

  useEffect(() => {
    onKeyActiveRef.current = onKeyActive
  }, [onKeyActive])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g'].includes(key)) return
      event.preventDefault()
      if (key === 'w') keysRef.current.forward = true
      if (key === 's') keysRef.current.back = true
      if (key === 'a') keysRef.current.left = true
      if (key === 'd') keysRef.current.right = true
      if (key === 'r') keysRef.current.raise = true
      if (key === 'f') keysRef.current.lower = true
      if (key === 't') keysRef.current.tiltBack = true
      if (key === 'g') keysRef.current.tiltForward = true
      if (key === 'e' && !event.repeat) onEngineToggleRef.current?.()
      setPressed((current) => {
        if (current[key]) return current
        if (key !== 'e') onKeyActiveRef.current?.(key)
        return { ...current, [key]: true }
      })
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'e', 'r', 'f', 't', 'g'].includes(key)) return
      if (key === 'w') keysRef.current.forward = false
      if (key === 's') keysRef.current.back = false
      if (key === 'a') keysRef.current.left = false
      if (key === 'd') keysRef.current.right = false
      if (key === 'r') keysRef.current.raise = false
      if (key === 'f') keysRef.current.lower = false
      if (key === 't') keysRef.current.tiltBack = false
      if (key === 'g') keysRef.current.tiltForward = false
      setPressed((current) => (current[key] ? { ...current, [key]: false } : current))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return { keysRef, pressed }
}
