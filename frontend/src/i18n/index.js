import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_LANGUAGE, getLanguage, subscribeToLanguage } from '../lib/language.js'
import { translate } from './translate.js'

export { translate, FALLBACK_LANGUAGE } from './translate.js'

// The browser-side face of the catalog. Import t() anywhere - inside a useFrame
// loop, a lib module, an event handler - and it reads whatever language is
// currently set. It is NOT reactive: a component whose text must change on a
// toggle uses useT() instead.
export function t(key, values) {
  return translate(getLanguage(), key, values)
}

export function useLanguage() {
  return useSyncExternalStore(subscribeToLanguage, getLanguage, () => DEFAULT_LANGUAGE)
}

// Returns a NEW function identity per language. A module-level t() keeps one
// identity forever, so every useMemo/useCallback that closed over it would keep
// rendering the old language after a toggle.
export function useT() {
  const language = useLanguage()
  return useMemo(() => (key, values) => translate(language, key, values), [language])
}
