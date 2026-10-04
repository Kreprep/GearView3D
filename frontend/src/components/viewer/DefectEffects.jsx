import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { DoubleSide, Euler, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { DECAL_TEXTURES, FLUIDS } from '../../data/defectLibrary'
import { getAudioEngine } from '../../lib/audio/audioEngine'
import { buildVehicleRig } from '../../lib/vehicleRig'

// The defect library's exterior recipes that add to the model or reshape a
// part of it (data/defectLibrary.js): decals, puddles, drips, an LPG plume,
// a sagging guard bar and a slack chain. The rig-driven recipes (a flat tyre,
// the mast, the carriage, a bent tine) are lib/defectPose.js, which
// HotspotViewer's frame loop applies. A recipe kind is drawn the same way for
// every defect that uses it, so a new defect is data, not code here.
//
// Positions are in the model's own frame (glTF axes, model units), like the
// hotspots. `model` is the cloned GLB. Its parts are found by name once the
// rig is built (lib/vehicleRig.js), which turns them into plain meshes: the
// layout effects here build it first. buildVehicleRig() builds once per model
// and hands the same rig back after, and these effects run before the
// viewer's own (a child's run first). Render this inside the group the model
// sits in.

const decalUrl = (texture) => `/textures/defects/${texture}.png`

// The decals are small, close-up surface marks: lit like the paint they sit
// on, and pulled toward the camera so they never fight it for depth.
const DECAL_MATERIAL = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.6, metalness: 0.1 }
// The wet stain shines like the oil it is.
const DECAL_FINISH = { wet: { roughness: 0.08, metalness: 0.2 }, frost: { roughness: 0.9 } }
const DECAL_DEPTH = 0.03

// A model-frame point and normal, as a decal projector's world position and
// orientation (looking into the surface along -normal, turned `spin` about
// it).
function projector(model, position, normal, spin = 0) {
  const at = model.localToWorld(new Vector3(...position))
  const modelRotation = new Quaternion()
  model.getWorldQuaternion(modelRotation)
  const into = new Vector3(...normal).normalize().applyQuaternion(modelRotation)
  const up = Math.abs(into.y) > 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const look = new Matrix4().lookAt(at.clone().add(into), at, up)
  const orientation = new Quaternion().setFromRotationMatrix(look)
  orientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), spin))
  return { at, orientation: new Euler().setFromQuaternion(orientation) }
}

// The decals, projected once onto their parts and parented to them, so a
// decal on a tine or a wheel goes where the part goes.
function Decals({ model, steps }) {
  const urls = useMemo(() => [...new Set(steps.map((step) => decalUrl(step.texture)))], [steps])
  const textures = useTexture(urls)

  useLayoutEffect(() => {
    buildVehicleRig(model)
    model.updateWorldMatrix(true, true)
    const placed = []
    steps.forEach((step) => {
      const target = model.getObjectByName(step.node)
      if (!target?.isMesh || !DECAL_TEXTURES.includes(step.texture)) return
      const map = textures[urls.indexOf(decalUrl(step.texture))]
      map.colorSpace = SRGBColorSpace
      const { at, orientation } = projector(model, step.position, step.normal, step.spin)
      const geometry = new DecalGeometry(target, at, orientation, new Vector3(step.size[0], step.size[1], DECAL_DEPTH))
      // DecalGeometry gives world-space vertices; the decal hangs on the part.
      geometry.applyMatrix4(new Matrix4().copy(target.matrixWorld).invert())
      const material = new MeshStandardMaterial({ map, ...DECAL_MATERIAL, ...DECAL_FINISH[step.texture] })
      const decal = new Mesh(geometry, material)
      decal.renderOrder = 2
      target.add(decal)
      placed.push(decal)
    })
    return () => {
      placed.forEach((decal) => {
        decal.removeFromParent()
        decal.geometry.dispose()
        decal.material.dispose()
      })
    }
  }, [model, steps, textures, urls])

  return null
}

// Reshape a mesh's vertices in the model's frame: `move(point, bounds)`
// returns the new point (a Vector3 to change in place), `bounds` being the
// mesh's box in the model frame. The geometry is copied, so the GLB's own
// stays as loaded, and put back when the recipe goes.
function useModelFrameDeform(model, nodeName, move) {
  useLayoutEffect(() => {
    buildVehicleRig(model)
    const mesh = model.getObjectByName(nodeName)
    if (!mesh?.isMesh || !move) return undefined
    model.updateWorldMatrix(true, true)
    const original = mesh.geometry
    const geometry = original.clone()
    const toModel = new Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld)
    const toMesh = new Matrix4().copy(toModel).invert()
    const position = geometry.attributes.position
    const point = new Vector3()
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(toModel)
      min.min(point)
      max.max(point)
    }
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(toModel)
      move(point, { min, max })
      point.applyMatrix4(toMesh)
      position.setXYZ(i, point.x, point.y, point.z)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    mesh.geometry = geometry
    return () => {
      mesh.geometry = original
      geometry.dispose()
    }
  }, [model, nodeName, move])
}

// A guard bar sagging in its middle, along its length (the model's z).
function BentBar({ model, step }) {
  const move = useMemo(
    () => (point, { min, max }) => {
      const along = (point.z - min.z) / Math.max(max.z - min.z, 1e-6)
      point.y -= step.sag * Math.sin(Math.PI * along)
    },
    [step.sag],
  )
  useModelFrameDeform(model, step.node, move)
  return null
}

// A slack lift chain bowing outward (away from the mast's centre) along its
// height.
function SlackChain({ model, node, sag }) {
  const move = useMemo(
    () => (point, { min, max }) => {
      const along = (point.y - min.y) / Math.max(max.y - min.y, 1e-6)
      point.x += Math.sign(point.x || 1) * sag * Math.sin(Math.PI * along)
    },
    [sag],
  )
  useModelFrameDeform(model, node, move)
  return null
}

// A puddle on the floor: three overlapping discs, so its edge is not a
// perfect circle, glossy like a spill.
const PUDDLE_LOBES = [
  [0, 0, 1],
  [0.45, 0.2, 0.62],
  [-0.35, -0.3, 0.55],
]

function Puddle({ fluid, position, radius }) {
  const look = FLUIDS[fluid] || FLUIDS.oil
  return (
    <group position={[position[0], 0.0015, position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      {PUDDLE_LOBES.map(([dx, dy, scale]) => (
        <mesh key={`${dx},${dy}`} position={[dx * radius, dy * radius, 0]} renderOrder={1}>
          <circleGeometry args={[radius * scale, 40]} />
          <meshStandardMaterial color={look.color} transparent opacity={look.opacity} roughness={0.08} metalness={0.1} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

// Drops falling from a point to the floor, a few at a time, staggered.
const DROP_COUNT = 3
const DROP_PERIOD = 1.4
const DROP_RADIUS = 0.0035
const DROP_GRAVITY = 2.4 // model units / s^2: about 9.8 m/s^2 at the model's scale

function Drip({ fluid, position }) {
  const look = FLUIDS[fluid] || FLUIDS.oil
  const refs = useRef([])
  const fallTime = Math.sqrt((2 * position[1]) / DROP_GRAVITY)

  useFrame(({ clock }) => {
    refs.current.forEach((drop, index) => {
      if (!drop) return
      const age = (clock.getElapsedTime() + (index * DROP_PERIOD) / DROP_COUNT) % DROP_PERIOD
      // A drop swells at the point, then lets go and falls.
      const hanging = DROP_PERIOD - fallTime
      if (age < hanging) {
        const grow = age / hanging
        drop.position.set(position[0], position[1] - DROP_RADIUS * grow, position[2])
        drop.scale.setScalar(0.4 + 0.6 * grow)
      } else {
        const t = age - hanging
        drop.position.set(position[0], Math.max(position[1] - 0.5 * DROP_GRAVITY * t * t, 0), position[2])
        drop.scale.set(0.8, 1.6, 0.8)
      }
    })
  })

  return Array.from({ length: DROP_COUNT }, (_, index) => (
    <mesh key={index} ref={(node) => (refs.current[index] = node)}>
      <sphereGeometry args={[DROP_RADIUS, 10, 10]} />
      <meshStandardMaterial color={look.color} roughness={0.05} metalness={0.2} transparent opacity={Math.min(look.opacity + 0.15, 1)} />
    </mesh>
  ))
}

// An LPG leak's plume: puffs of cold vapour leaving the fitting, rising and
// spreading as they thin out.
const PUFF_COUNT = 9
const PUFF_LIFE = 1.6

function Vapour({ position }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((puff, index) => {
      if (!puff) return
      const age = ((clock.getElapsedTime() + (index * PUFF_LIFE) / PUFF_COUNT) % PUFF_LIFE) / PUFF_LIFE
      const drift = Math.sin(index * 2.3) * 0.01
      puff.position.set(position[0] + 0.03 * age + drift, position[1] + 0.06 * age, position[2] + drift)
      puff.scale.setScalar(0.004 + 0.022 * age)
      puff.material.opacity = 0.32 * (1 - age)
    })
  })
  return Array.from({ length: PUFF_COUNT }, (_, index) => (
    <mesh key={index} ref={(node) => (refs.current[index] = node)}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#eef6ff" transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
  ))
}

// Loops a scenario plays while it is on screen (`while: 'shown'`, the LPG
// hiss). The cab plays the rest (lib/driving/drivingAudio.js).
function useShownLoops(sounds) {
  const names = useMemo(() => sounds.filter((rule) => rule.loop && rule.while === 'shown').map((rule) => rule.loop).join(','), [sounds])
  useEffect(() => {
    if (!names) return undefined
    const engine = getAudioEngine()
    const loops = names.split(',').map((name) => {
      const loop = engine.createLoop(name)
      loop.setGain(1)
      return loop
    })
    return () => loops.forEach((loop) => loop.stop())
  }, [names])
}

export function DefectEffects({ model, visual = [], sounds = [], chainNodes }) {
  useShownLoops(sounds)
  const decals = useMemo(() => visual.filter((step) => step.kind === 'decal'), [visual])
  return (
    <>
      {model && decals.length > 0 && <Decals model={model} steps={decals} />}
      {model &&
        visual.map((step, index) => {
          const key = `${step.kind}-${index}`
          if (step.kind === 'bend-bar') return <BentBar key={key} model={model} step={step} />
          if (step.kind === 'slack-chain') return <SlackChain key={key} model={model} node={chainNodes[step.side]} sag={step.sag} />
          return null
        })}
      {visual.map((step, index) => {
        const key = `${step.kind}-${index}`
        if (step.kind === 'puddle') return <Puddle key={key} {...step} />
        if (step.kind === 'drip') return <Drip key={key} {...step} />
        if (step.kind === 'vapour') return <Vapour key={key} {...step} />
        return null
      })}
    </>
  )
}
