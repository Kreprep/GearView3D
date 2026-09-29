import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { BufferAttribute } from 'three'
import { createSimLoop } from '../lib/driving/simLoop.js'
import { createForkSpike, createScenarioRunner, FORK_SPIKE_SCENARIOS } from '../lib/physics/forkSpike.js'
import { loadRapier } from '../lib/physics/rapier.js'

// Development-only view of the Phase 2 physics spike (physics-spike.html).
// It draws Rapier's own collider wireframes, so what you see is exactly what
// the physics simulates, and runs the scripted scenarios forkSpike.test.js
// measures. window.__physicsSpike exposes the live read-out for Playwright.

const PALLET_Z = 1
const CAMERA_OFFSET = [0.75, 0.45, -0.35]

function SpikeScene({ RAPIER, scenarioId, readoutRef }) {
  const simRef = useRef(null)
  const geometryRef = useRef(null)

  useEffect(() => {
    const spike = createForkSpike(RAPIER)
    const runner = createScenarioRunner(spike, FORK_SPIKE_SCENARIOS[scenarioId], PALLET_Z)
    let done = false
    const loop = createSimLoop(() => {
      if (!done) done = !runner.next()
    })
    simRef.current = { spike, runner, loop, isDone: () => done }
    return () => {
      simRef.current = null
      spike.dispose()
    }
  }, [RAPIER, scenarioId])

  useFrame(({ camera }, delta) => {
    const sim = simRef.current
    const geometry = geometryRef.current
    if (!sim || !geometry) return
    sim.loop.advance(delta)

    const { vertices, colors } = sim.spike.world.debugRender()
    geometry.setAttribute('position', new BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    geometry.computeBoundingSphere()

    const carriage = sim.spike.carriage.translation()
    camera.position.set(carriage.x + CAMERA_OFFSET[0], carriage.y + CAMERA_OFFSET[1], carriage.z + CAMERA_OFFSET[2])
    camera.lookAt(carriage.x, carriage.y, carriage.z + 0.15)

    const reading = sim.spike.palletOnForks()
    const snapshot = {
      scenario: scenarioId,
      segment: sim.runner.segment,
      done: sim.isDone(),
      time: Number(sim.runner.state.time.toFixed(2)),
      onForks: Object.fromEntries(Object.entries(reading.position).map(([axis, value]) => [axis, Number(value.toFixed(5))])),
      leanDeg: Number(((reading.lean * 180) / Math.PI).toFixed(2)),
      palletHeight: Number(sim.spike.palletBody.translation().y.toFixed(4)),
      marks: sim.runner.marks,
    }
    window.__physicsSpike = snapshot
    if (readoutRef.current) readoutRef.current.textContent = JSON.stringify(snapshot, null, 2)
  })

  return (
    <>
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={geometryRef} />
        <lineBasicMaterial vertexColors transparent />
      </lineSegments>
      <gridHelper args={[4, 40, '#334155', '#1e293b']} position={[0, 0.0005, 1]} />
    </>
  )
}

export function PhysicsSpike() {
  const [RAPIER, setRapier] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [scenarioId, setScenarioId] = useState('full-lift-hold')
  const [runKey, setRunKey] = useState(0)
  const readoutRef = useRef(null)

  useEffect(() => {
    loadRapier().then(setRapier, (error) => setLoadError(String(error)))
  }, [])

  const run = (id) => {
    setScenarioId(id)
    setRunKey((key) => key + 1)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gridTemplateRows: '100vh', color: '#e2e8f0', font: '13px system-ui' }}>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        {loadError && <p role="alert">Rapier failed to load: {loadError}</p>}
        {RAPIER && (
          <Canvas camera={{ fov: 40, near: 0.01, far: 50 }}>
            <SpikeScene key={runKey} RAPIER={RAPIER} scenarioId={scenarioId} readoutRef={readoutRef} />
          </Canvas>
        )}
      </div>
      <aside style={{ padding: 16, overflow: 'auto', background: '#111827' }}>
        <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>Physics spike (Rapier {RAPIER?.version() ?? '...'})</h1>
        {Object.entries(FORK_SPIKE_SCENARIOS).map(([id, scenario]) => (
          <button
            key={id}
            type="button"
            data-scenario={id}
            onClick={() => run(id)}
            style={{ display: 'block', width: '100%', marginBottom: 6, textAlign: 'left', fontWeight: id === scenarioId ? 700 : 400 }}
          >
            {scenario.title}
          </button>
        ))}
        <pre ref={readoutRef} style={{ whiteSpace: 'pre-wrap' }} />
      </aside>
    </div>
  )
}
