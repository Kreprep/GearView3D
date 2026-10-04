import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { loadRapier } from '../../lib/physics/rapier'

// Renders `children` once the physics engine is loaded. Rapier is its own
// chunk, fetched the first time a driving composition mounts
// (lib/physics/rapier.js), and an attempt needs it before it can build its
// simulation core. Until then, or if the fetch fails, the composition's
// frame shows a status line.
export function PhysicsGate({ className = '', children }) {
  const [physics, setPhysics] = useState('loading')
  const t = useT()
  useEffect(() => {
    let mounted = true
    loadRapier().then(
      () => mounted && setPhysics('ready'),
      () => mounted && setPhysics('failed'),
    )
    return () => {
      mounted = false
    }
  }, [])

  if (physics === 'ready') return children
  return (
    <section className={`driving-simulation ${className}`}>
      <p className="driving-loading" role={physics === 'failed' ? 'alert' : 'status'}>
        {t(physics === 'failed' ? 'driving.hud.loadFailed' : 'driving.hud.loading')}
      </p>
    </section>
  )
}
