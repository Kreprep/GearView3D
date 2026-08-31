import { LANGUAGES, setLanguage } from '../lib/language'
import { useLanguage, useT } from '../i18n'

// The app-wide EN / FIL switch. Standalone rather than part of AppHeader,
// because /login has no header and is the one screen where the choice has to be
// made before the learner has read anything.
//
// Written in Tailwind, not in AppHeader.css: it is mounted both inside a
// global-CSS component and (from Phase D) inside a Tailwind page that does not
// import that stylesheet, so it has to carry its own styling.
//
// A radio group, not a checkbox: role="group" over two buttons with aria-pressed
// says "two states, one active" without hijacking arrow keys the way role=radio
// would in a header full of ordinary tab stops.
// A tone, not a className override: the tray and the two buttons all set
// background-color, and two competing background utilities on one element
// resolve by stylesheet order rather than by the order they are written in the
// class attribute - which is to say, unpredictably.
const TONE_CLASSES = {
  light: {
    tray: 'bg-slate-100',
    active: 'bg-white text-ink shadow-sm',
    idle: 'text-muted hover:text-ink',
  },
  deep: {
    tray: 'bg-white/10',
    active: 'bg-surface-deep-accent text-surface-deep',
    idle: 'text-white/70 hover:text-white',
  },
}

function LanguageToggle({ tone = 'light', className = '' }) {
  const language = useLanguage()
  const t = useT()
  const classes = TONE_CLASSES[tone] || TONE_CLASSES.light

  return (
    <div
      role="group"
      aria-label={t('header.language.label')}
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${classes.tray} ${className}`.trim()}
    >
      {LANGUAGES.map((entry) => {
        const active = entry.code === language

        return (
          <button
            key={entry.code}
            type="button"
            aria-pressed={active}
            // The visible label is the endonym ("EN" / "FIL"), which is the same
            // in either language; the accessible name says what pressing does.
            aria-label={t('header.language.switchTo', { language: entry.name })}
            onClick={() => setLanguage(entry.code)}
            className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
              active ? classes.active : `bg-transparent ${classes.idle}`
            }`}
          >
            {entry.label}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageToggle
