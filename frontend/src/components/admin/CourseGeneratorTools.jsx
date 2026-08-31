import { useState } from 'react'
import { coneBay, coneBox, coneLine, corridorCones, slalomCones } from '../../lib/courseGenerators'
import { Button } from '../ui/button'
import { PanelNote } from '../ui/panel'
import { Field } from '../ui/field'
import { Input, Textarea, Select } from '../ui/input'

// Bulk cone layouts. Output is baked into the course's decorations list as
// loose cones, so anything generated here can afterwards be nudged or deleted
// one cone at a time.
const GENERATORS = {
  line: {
    label: 'Cone line',
    hint: 'A straight boundary line of cones at a fixed X, from zStart to zEnd.',
    fields: [
      ['x', 'X', -2.4],
      ['zStart', 'Z start', 2],
      ['zEnd', 'Z end', 20],
      ['spacing', 'Spacing', 2.4],
    ],
    build: (v) => coneLine(v.x, v.zStart, v.zEnd, v.spacing),
  },
  corridor: {
    label: 'Corridor',
    hint: 'Cones down both sides of a path. One waypoint per line as "x, z", in driving order.',
    fields: [
      ['halfWidth', 'Half width', 0.75],
      ['spacing', 'Spacing', 1.3],
    ],
    textField: ['waypoints', 'Waypoints', '0, 0\n0, 9\n-2.6, 16\n0, 22'],
    build: (v) => {
      const waypoints = v.waypoints
        .split('\n')
        .map((line) => line.split(',').map((part) => Number(part.trim())))
        .filter((pair) => pair.length === 2 && pair.every((n) => Number.isFinite(n)))
      return waypoints.length >= 2 ? corridorCones(waypoints, v.halfWidth, v.spacing) : []
    },
  },
  bay: {
    label: 'Parking bay markers',
    hint: 'Three walls of cones around a bay, open on the approach side.',
    fields: [
      ['x', 'X', -2.6],
      ['z', 'Z', 16],
      ['width', 'Width', 0.45],
      ['depth', 'Depth', 1],
      ['margin', 'Margin', 0.15],
    ],
    build: (v) => coneBay({ x: v.x, z: v.z, width: v.width, depth: v.depth }, v.margin, 'front'),
  },
  box: {
    label: 'Parallel-park box',
    hint: 'A cone at each corner of a pocket - the driving-test parallel parking layout.',
    fields: [
      ['x', 'X', -1.2],
      ['z', 'Z', 13],
      ['width', 'Width', 0.42],
      ['depth', 'Depth', 1.3],
      ['margin', 'Margin', 0.15],
    ],
    build: (v) => coneBox({ x: v.x, z: v.z, width: v.width, depth: v.depth }, v.margin),
  },
  slalom: {
    label: 'Slalom',
    hint: 'Cones alternating left and right. Pair these with checkpoints offset toward each cone to force the weave.',
    fields: [
      ['amplitude', 'Amplitude', 0.95],
      ['zStart', 'Z start', 3],
      ['spacing', 'Spacing', 2.4],
      ['count', 'Cone count', 8],
    ],
    build: (v) => slalomCones(v.amplitude, v.zStart, v.spacing, Math.max(1, Math.round(v.count))),
  },
}

function defaultValues(generator) {
  const values = Object.fromEntries(generator.fields.map(([name, , fallback]) => [name, fallback]))
  if (generator.textField) values[generator.textField[0]] = generator.textField[2]
  return values
}

function CourseGeneratorTools({ onInsert }) {
  const [kind, setKind] = useState('line')
  const [values, setValues] = useState(() => defaultValues(GENERATORS.line))

  const generator = GENERATORS[kind]

  const selectKind = (nextKind) => {
    setKind(nextKind)
    setValues(defaultValues(GENERATORS[nextKind]))
  }

  const insert = () => {
    const cones = generator.build(values)
    if (cones.length) onInsert(cones)
  }

  return (
    <div className="grid gap-2">
      <Field label="Layout">
        <Select value={kind} onChange={(event) => selectKind(event.target.value)}>
          {Object.entries(GENERATORS).map(([value, entry]) => (
            <option key={value} value={value}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>

      <PanelNote>{generator.hint}</PanelNote>

      <div className="grid grid-cols-2 gap-2">
        {generator.fields.map(([name, label]) => (
          <Field key={name} label={label}>
            <Input
              type="number"
              step={0.05}
              value={values[name]}
              onChange={(event) => setValues({ ...values, [name]: Number(event.target.value) })}
            />
          </Field>
        ))}
      </div>

      {generator.textField && (
        <Field label={generator.textField[1]}>
          <Textarea
            rows={5}
            value={values[generator.textField[0]]}
            onChange={(event) => setValues({ ...values, [generator.textField[0]]: event.target.value })}
          />
        </Field>
      )}

      <Button type="button" className="justify-self-start" onClick={insert}>
        Insert cones
      </Button>
    </div>
  )
}

export default CourseGeneratorTools
