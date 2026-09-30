import { useEffect, useRef } from 'react'
import { snapshotGamepads, subscribeToGamepads } from '../lib/driving/gamepadBrowser'

// Calls `onPoll(pads)` with a fresh gamepad snapshot every animation frame
// while mounted, and once more whenever a pad connects or disconnects. For
// screens outside the driving scene (Controller Setup); the scene polls from
// its own frame loop.
export function useGamepadPoll(onPoll) {
  const onPollRef = useRef(onPoll)
  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    let frame = requestAnimationFrame(function poll() {
      onPollRef.current(snapshotGamepads())
      frame = requestAnimationFrame(poll)
    })
    const unsubscribe = subscribeToGamepads(() => onPollRef.current(snapshotGamepads()))
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [])
}
