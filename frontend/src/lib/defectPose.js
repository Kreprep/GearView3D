import { FORKLIFT_RIG_GEOMETRY } from './driving/rigGeometry.js'

// How the rig-driven defect recipes (data/defectLibrary.js: deflate-wheel,
// roll-carriage, tilt-mast, bend-fork) pose forklift.glb's rig, as numbers
// HotspotViewer's frame loop eases the rig toward. Pure, so it is tested
// without a scene; the other recipe kinds draw or deform geometry and live
// in components/viewer/DefectEffects.jsx.
//
//   mastTilt       rotation.x of the mast's tilt pivot (forward positive), or
//                  null when no recipe holds the mast
//   carriageRoll   rotation.z of the carriage's lift group (+X side up)
//   forkBend       { L, R }: rotation.x of each tine's heel pivot (tip down)
//   wheelSquash    { FL, FR, RL, RR }: share of each tyre's radius it has
//                  lost
//   bodyRoll       rotation.z of the whole truck (+X side up)
//   bodyPitch      rotation.x of the whole truck (nose down positive)
//   bodyLift       position.y of the whole truck
//
// A counterbalance truck stands on three points: its two front wheels and
// the pivot in the middle of its rear axle, which swings so both rear wheels
// stay down. A flat front tyre drops that corner by what the tyre lost: the
// body tips about the line from the other front wheel to the rear pivot
// (small angles, so a roll, a pitch and a lift), and the squashed tyre, which
// squashes about its own centre, keeps its contact patch on the floor. A flat
// rear tyre lowers the rear pivot by half (the axle itself is not rolled).

const SIDE_SIGN = { L: 1, R: -1 }

export const NO_DEFECT_POSE = Object.freeze({
  mastTilt: null,
  carriageRoll: 0,
  forkBend: Object.freeze({ L: 0, R: 0 }),
  wheelSquash: Object.freeze({ FL: 0, FR: 0, RL: 0, RR: 0 }),
  bodyRoll: 0,
  bodyPitch: 0,
  bodyLift: 0,
})

// Where each wheel's centre is, in the model's frame (x across, z along).
export function wheelCentres(geometry = FORKLIFT_RIG_GEOMETRY) {
  const x = geometry.frontTrackHalf
  return {
    FL: { x, z: geometry.frontAxleZ },
    FR: { x: -x, z: geometry.frontAxleZ },
    RL: { x, z: geometry.rearAxleZ },
    RR: { x: -x, z: geometry.rearAxleZ },
  }
}

export function defectPose(visual = [], geometry = FORKLIFT_RIG_GEOMETRY) {
  const pose = {
    ...NO_DEFECT_POSE,
    forkBend: { ...NO_DEFECT_POSE.forkBend },
    wheelSquash: { ...NO_DEFECT_POSE.wheelSquash },
  }
  const centres = wheelCentres(geometry)

  for (const step of visual) {
    if (step.kind === 'tilt-mast') pose.mastTilt = step.angle
    else if (step.kind === 'roll-carriage') pose.carriageRoll -= (SIDE_SIGN[step.side] ?? 1) * step.angle
    else if (step.kind === 'bend-fork' && step.side in pose.forkBend) pose.forkBend[step.side] = step.angle
    else if (step.kind === 'deflate-wheel' && step.wheel in pose.wheelSquash) {
      const amount = Math.min(Math.max(step.amount, 0), 0.6)
      pose.wheelSquash[step.wheel] = amount
      // The body's new height is a plane dy = roll * x - pitch * z + lift
      // through the three points it stands on.
      const drop = amount * geometry.wheelRadius[step.wheel]
      const { x, z } = centres[step.wheel]
      const span = geometry.frontAxleZ - geometry.rearAxleZ
      if (z === geometry.frontAxleZ) {
        // Through the other front wheel (0) and the rear pivot (0).
        const slope = -drop / (2 * span)
        pose.bodyRoll -= drop / (2 * x)
        pose.bodyPitch -= slope
        pose.bodyLift -= slope * geometry.rearAxleZ
      } else {
        // Through both front wheels (0) and the rear pivot (-drop / 2).
        const slope = drop / (2 * span)
        pose.bodyPitch -= slope
        pose.bodyLift -= slope * geometry.frontAxleZ
      }
    }
  }
  return pose
}

// How far a model-frame point (x, z) moves up under the body's pose, to
// first order. For the test of what a flat tyre does to each corner.
export const bodyLift = ({ bodyRoll, bodyPitch, bodyLift: lift }, { x, z }) => x * bodyRoll - z * bodyPitch + lift
