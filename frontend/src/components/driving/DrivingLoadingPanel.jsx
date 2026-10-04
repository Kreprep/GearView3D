import { Html } from '@react-three/drei'
import { useT } from '../../i18n'

export function DrivingLoadingPanel() {
  const t = useT()
  return (
    <Html center zIndexRange={[100, 0]}>
      <div className="interactive-loading-panel">
        <div />
        <p>{t('driving.hud.loading')}</p>
      </div>
    </Html>
  )
}
