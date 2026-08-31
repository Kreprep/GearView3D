import { Monitor } from 'lucide-react'
import { useT } from '../i18n'
import LanguageToggle from './LanguageToggle'

// GearView3D is a laptop/desktop tool: the driving simulation is WASD-driven
// and the 3D viewers need room for a model beside a panel of text. Below the
// breakpoint the app renders this instead of a layout that would be cramped
// and, in the simulation's case, unusable.
//
// It carries the language switch: a trainee who opens the link on a phone needs
// to be able to read this in their own language, and it is the only screen they
// can reach.
export const DESKTOP_MIN_WIDTH = 1024
export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`

function DesktopOnlyNotice() {
  const t = useT()

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-surface-deep px-5 py-4">
          <span className="text-lg font-extrabold tracking-tight text-white">GearView3D</span>
          <LanguageToggle tone="deep" />
        </div>

        <div className="grid justify-items-start gap-3 p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Monitor size={22} aria-hidden="true" />
          </span>
          <h1 className="m-0 text-xl font-extrabold tracking-tight text-ink">
            {t('common.desktopOnly.title')}
          </h1>
          <p className="m-0 text-sm leading-relaxed text-body">{t('common.desktopOnly.body')}</p>
          <p className="m-0 text-sm font-semibold text-ink">{t('common.desktopOnly.hint')}</p>
        </div>
      </div>
    </div>
  )
}

export default DesktopOnlyNotice
