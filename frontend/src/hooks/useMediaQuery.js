import { useCallback, useSyncExternalStore } from 'react'

// Subscribes to a CSS media query, so a layout decision that genuinely cannot
// be expressed in CSS - rendering a different component tree, not restyling one
// - re-renders when the viewport crosses the breakpoint.
//
// useSyncExternalStore rather than a resize listener + useState: matchMedia
// fires only on the crossing rather than on every resize frame, and the
// server-snapshot argument keeps the hook safe to import outside a browser.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}

      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true
    return window.matchMedia(query).matches
  }, [query])

  // Assume the query matches when there is no window to ask: a false here would
  // render the "too small" screen during any non-browser render.
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
