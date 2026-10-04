import { useState } from 'react'
import {
  ArrowBigLeft,
  ArrowBigRight,
  BatteryWarning,
  ChevronDown,
  ChevronUp,
  CircleParking,
  Droplet,
  Fuel,
  Lightbulb,
  ListChecks,
  Megaphone,
  PackageX,
  Siren,
  Thermometer,
  Weight,
} from 'lucide-react'
import { useT } from '../../i18n'
import { useTelemetry } from '../../hooks/useTelemetry'
import { KEY_POSITIONS } from '../../lib/driving/dashboardSource'
import { GRIP_LABEL_KEYS } from '../../lib/driving/constants'
import { DIRECTIONS } from '../../lib/driving/controls'
import { loadChartPoints } from '../../lib/physics/loadChart'
import { AudioControl } from '../AudioControl'
import './OperatorDashboard.css'

// The operator's instrument cluster and controls (docs/revisions/
// post-defense-plan.md, section 4.2), permanently at the bottom centre of
// the driving screen in every camera mode. It reads the telemetry store
// (never per-frame React state) and writes through the dashboard control
// source, so a click here and the matching key (E, B, Space, H) move the
// same switch.
//
// Three panels: the key switch and direction lever on the left, the meter
// and warning lamps in the middle, the cab switches and hydraulic levers on
// the right, with the volume and mute. Lamps light only with the key on, as
// a real cluster's do: at key ON every warning lamp lights for two seconds
// (the bulb check), and the oil-pressure and charge lamps stay lit until the
// engine runs.
//
// When the pre-start interlock refuses a start, the controls it still wants
// (seatbelt, parking brake, lever in N) are marked until the engine starts.
// A connected shifter owns the direction lever, so the on-screen lever only
// shows it.
//
// What each lamp shows is the cockpit snapshot's (lib/driving/
// cockpitTelemetry.js): the bulb check at key ON and any scripted instrument
// faults are applied there, not here.
//
// `inspect` (optional) is the engine-on inspection's: { targets:
// { [instrumentId]: status }, selected, onSelect(instrumentId) }, with the
// instrument ids of lib/inspection/instruments.js and a status of 'pending',
// 'correct' or 'wrong'. The listed instruments become buttons with a ring in
// their status's colour. Without it the dashboard is the driver's.

const CAB_KEYS = [
  { key: 'C', captionKey: 'driving.key.cameraNext' },
  { key: '← ↑ ↓ →', captionKey: 'driving.key.cameraJump' },
  { key: 'V', captionKey: 'driving.key.inset' },
  { key: 'H', captionKey: 'driving.key.horn' },
  { key: 'B', captionKey: 'driving.key.seatbelt' },
  { key: 'Space', captionKey: 'driving.key.parkingBrake' },
  { key: 'L', captionKey: 'driving.key.lights' },
  { key: 'O', captionKey: 'driving.key.beacon' },
  { key: '[ ]', captionKey: 'driving.key.turnSignals' },
]

const wholeSnapshot = (snapshot) => snapshot

const TURN_SIGNAL_SIDES = [
  { side: 'left', icon: ArrowBigLeft, key: '[' },
  { side: 'right', icon: ArrowBigRight, key: ']' },
]

// The seatbelt warning symbol: a seated figure with a belt across it (lucide
// has no seatbelt icon), in the same 24-unit stroke style.
function SeatbeltIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M8 21v-7a4 4 0 0 1 8 0v7" />
      <path d="M8.5 10.5 16 19" />
    </svg>
  )
}

// In inspect mode, an instrument the step asks about is a button ringed in
// its status's colour; any other instrument renders as it is.
function Inspectable({ inspect, instrument, label, className = '', children }) {
  const t = useT()
  const status = inspect?.targets?.[instrument]
  if (!status) return children
  return (
    <button
      type="button"
      className={`operator-inspect is-${status} ${inspect.selected === instrument ? 'is-selected' : ''} ${className}`}
      aria-label={t('driving.dash.inspect', { instrument: label })}
      title={t('driving.dash.inspect', { instrument: label })}
      onClick={() => inspect.onSelect?.(instrument)}
    >
      {children}
    </button>
  )
}

// A lamp: a symbol that lights, named for screen readers and on hover, read
// at a glance like a real cluster's. A span inside a lamp row that is itself
// a button (the inspection's "warning lamps").
function Lamp({ lit, tone, label, icon: Icon, blink = false, as: Tag = 'li' }) {
  const t = useT()
  return (
    <Tag
      className={`operator-lamp ${tone} ${lit ? 'is-lit' : ''} ${lit && blink ? 'is-blinking' : ''}`}
      title={label}
      aria-label={t(lit ? 'driving.dash.lampState.on' : 'driving.dash.lampState.off', { lamp: label })}
    >
      <Icon width={15} height={15} aria-hidden="true" />
    </Tag>
  )
}

function Gauge({ label, value, bands, icon: Icon }) {
  return (
    <span className="operator-gauge" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} title={label}>
      <Icon width={12} height={12} aria-hidden="true" />
      <span className={`operator-gauge-track ${bands}`} aria-hidden="true">
        <span className="operator-gauge-needle" style={{ left: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
      </span>
    </span>
  )
}

// The warning row: each lamp's snapshot key, and its instrument
// (lib/inspection/instruments.js) where the inspection can ask about it.
const WARNING_LAMP_ROW = [
  { instrument: 'lamp.parkingBrake', field: 'lampParkingBrake', tone: 'danger', icon: CircleParking, labelKey: 'driving.dash.lamp.parkingBrake' },
  { instrument: 'lamp.seatbelt', field: 'lampSeatbelt', tone: 'danger', icon: SeatbeltIcon, labelKey: 'driving.dash.lamp.seatbelt' },
  { instrument: 'lamp.oil', field: 'lampOil', tone: 'danger', icon: Droplet, labelKey: 'driving.dash.lamp.oil' },
  { instrument: 'lamp.charge', field: 'lampCharge', tone: 'danger', icon: BatteryWarning, labelKey: 'driving.dash.lamp.charge' },
  { field: 'lampOverload', tone: 'danger', icon: Weight, labelKey: 'driving.dash.lamp.overload' },
  { field: 'lampLoadInsecure', tone: 'caution', icon: PackageX, labelKey: 'driving.dash.lamp.loadInsecure' },
]

// The warning lamps as a list; in inspect mode a lamp the step asks about is
// a button. When the step asks about the whole row (judged on the bulb
// check), the row is ringed and judged from a button of its own at its
// start, so a single lamp in it can still be asked about too.
function WarningLamps({ snapshot, inspect }) {
  const t = useT()
  const label = t('driving.dash.lamps')
  const list = (
    <ul className="operator-lamps" aria-label={label}>
      {WARNING_LAMP_ROW.map(({ instrument, field, tone, icon, labelKey }) =>
        inspect?.targets?.[instrument] ? (
          <li key={field}>
            <Inspectable inspect={inspect} instrument={instrument} label={t(labelKey)}>
              <Lamp as="span" lit={snapshot[field]} tone={tone} icon={icon} label={t(labelKey)} />
            </Inspectable>
          </li>
        ) : (
          <Lamp key={field} lit={snapshot[field]} tone={tone} icon={icon} label={t(labelKey)} />
        ),
      )}
    </ul>
  )
  const rowStatus = inspect?.targets?.lamps
  if (!rowStatus) return list
  return (
    <div className={`operator-inspect-group is-${rowStatus} ${inspect.selected === 'lamps' ? 'is-selected' : ''}`}>
      <Inspectable inspect={inspect} instrument="lamps" label={label} className="operator-inspect-row">
        <ListChecks width={15} height={15} aria-hidden="true" />
      </Inspectable>
      {list}
    </div>
  )
}

// A hydraulic lever's deflection, -1..1, drawn as a slot with a knob.
function LeverIndicator({ label, value }) {
  return (
    <div className="operator-lever" role="img" aria-label={`${label}: ${value}`}>
      <span className="operator-lever-slot" aria-hidden="true">
        <span className="operator-lever-knob" style={{ top: `${50 - value * 40}%` }} />
      </span>
      <span className="operator-lever-label">{label}</span>
    </div>
  )
}

// The truck's capacity plate, as a load chart (TESDA CON834218 element 3:
// "loads are calculated based on load center"): capacity against how far out
// along the forks the load's centre of gravity sits, with the load the forks
// are in plotted on it. A load above the curve is over capacity.
const PLATE = { width: 64, height: 30, from: 0.4, to: 1.4, headroom: 1.3 }

function CapacityPlate({ ratedKg, ratedCentre, loadKg, loadCentre, limitKg, over }) {
  const t = useT()
  const x = (centre) => ((Math.min(Math.max(centre, PLATE.from), PLATE.to) - PLATE.from) / (PLATE.to - PLATE.from)) * PLATE.width
  const y = (kg) => PLATE.height - (Math.min(kg / (ratedKg * PLATE.headroom), 1)) * PLATE.height
  const curve = loadChartPoints(ratedKg, PLATE)
    .map(({ loadCentre: centre, capacityKg }) => `${x(centre).toFixed(1)},${y(capacityKg).toFixed(1)}`)
    .join(' ')
  const hasLoad = loadKg != null

  return (
    <div className={`operator-readout operator-plate ${over ? 'is-danger' : ''}`}>
      <svg className="operator-plate-chart" viewBox={`0 0 ${PLATE.width} ${PLATE.height}`} role="img" aria-label={t('driving.dash.plate.chart')}>
        <path className="operator-plate-axes" d={`M0 0V${PLATE.height}H${PLATE.width}`} />
        <polyline className="operator-plate-curve" points={curve} />
        {hasLoad && <circle className="operator-plate-load" cx={x(loadCentre)} cy={y(loadKg)} r="2.4" />}
      </svg>
      <span className="operator-readout-value small">
        {hasLoad
          ? t('driving.dash.plate.load', { load: loadKg.toLocaleString(), limit: limitKg.toLocaleString(), centre: loadCentre.toFixed(2) })
          : t('driving.dash.plate.rated', { capacity: ratedKg.toLocaleString(), centre: ratedCentre.toFixed(2) })}
      </span>
      <span className="operator-readout-label">{t('driving.dash.plate')}</span>
    </div>
  )
}

export function OperatorDashboard({ telemetry, dashboard, keyLegend, pressed, inspect }) {
  const t = useT()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Nearly every field is on show, and the store only replaces the snapshot
  // when something in it changed, so the cluster reads it whole.
  const snapshot = useTelemetry(telemetry, wholeSnapshot)
  const {
    engineOn, keyPosition, direction, leverEngaged, shifterActive, seatbelt, parkingBrake, lights, beacon, turnSignal,
    needSeatbelt, needParkingBrake, needNeutral,
    speedKmh, forkHeightM, tiltDeg, tilt, grip, palletState,
    ratedCapacityKg, ratedLoadCentreM, plateLoadKg, plateLoadCentreM, plateLimitKg, plateOverCapacity,
    lampLights, lampBeacon, lampTurnLeft, lampTurnRight,
    fuel, temp, hours, liftInput, tiltInput,
  } = snapshot

  return (
    <section className="operator-dashboard" aria-label={t('driving.dash.label')}>
      <div className="operator-panel operator-panel-controls">
        <fieldset className="operator-group">
          <legend>{t('driving.dash.key')}</legend>
          {KEY_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              className={`operator-switch ${keyPosition === position ? 'is-active' : ''}`}
              aria-pressed={keyPosition === position}
              title={position === 'off' || position === 'start' ? t('driving.dash.shortcut', { label: t(`driving.dash.key.${position}`), key: 'E' }) : undefined}
              onClick={() => dashboard.turnKey(position, engineOn)}
            >
              {t(`driving.dash.key.${position}`)}
            </button>
          ))}
        </fieldset>

        <fieldset className="operator-group" disabled={shifterActive} title={shifterActive ? t('driving.dash.lever.shifter') : undefined}>
          <legend>{t('driving.dash.lever')}</legend>
          {DIRECTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={`operator-switch ${leverEngaged && direction === value ? 'is-active' : ''} ${value === 'N' && needNeutral ? 'is-required' : ''}`}
              aria-pressed={leverEngaged && direction === value}
              onClick={() => dashboard.setLever(value)}
            >
              {value}
            </button>
          ))}
          {!shifterActive && (
            <button
              type="button"
              className={`operator-switch ${leverEngaged ? '' : 'is-active'}`}
              aria-pressed={!leverEngaged}
              title={t('driving.dash.lever.autoHint')}
              onClick={() => dashboard.releaseLever()}
            >
              {t('driving.dash.lever.auto')}
            </button>
          )}
        </fieldset>
      </div>

      <div className="operator-panel operator-panel-meter">
        <div className="operator-meter">
          <div className="operator-readout operator-speed">
            <span className="operator-readout-value">{speedKmh}</span>
            <span className="operator-readout-label">{t('driving.dash.speedUnit')}</span>
          </div>

          <div className="operator-readout" aria-label={`${t('driving.dash.direction')}: ${direction}`}>
            <span className="operator-direction" aria-hidden="true">
              {DIRECTIONS.map((value) => (
                <span key={value} className={value === direction ? 'is-lit' : ''}>
                  {value}
                </span>
              ))}
            </span>
            <span className="operator-readout-label">{t('driving.dash.direction')}</span>
          </div>

          <div className="operator-readout">
            <span className="operator-readout-value small">{t('driving.dash.forksValue', { height: forkHeightM.toFixed(2) })}</span>
            <span className="operator-readout-label">{t('driving.dash.forks')}</span>
          </div>

          <div className={`operator-readout ${palletState === 'carried' && tilt !== 'back' ? 'is-warning' : ''}`}>
            <span className="operator-readout-value small">
              {t('driving.dash.mastValue', { degrees: Math.abs(tiltDeg).toFixed(1), state: t(`driving.dash.mastState.${tilt}`) })}
            </span>
            <span className="operator-readout-label">{t('driving.dash.mast')}</span>
          </div>

          <CapacityPlate
            ratedKg={ratedCapacityKg}
            ratedCentre={ratedLoadCentreM}
            loadKg={plateLoadKg}
            loadCentre={plateLoadCentreM}
            limitKg={plateLimitKg}
            over={plateOverCapacity}
          />

          {/* How far the forks are in. It decides whether a load stays put, so
              the learner has to be able to read it without guessing from the
              model. */}
          {grip !== 'none' && (
            <div className={`operator-readout ${grip === 'secure' ? '' : 'is-warning'}`}>
              <span className="operator-readout-value small">{t(GRIP_LABEL_KEYS[grip])}</span>
              <span className="operator-readout-label">{t('driving.dash.grip')}</span>
            </div>
          )}
        </div>

        <div className="operator-status">
          {/* The indicators for what the operator switched on flank the
              warning row, the turn arrows outermost, as on a real cluster. */}
          <ul className="operator-lamps" aria-label={t('driving.dash.indicators')}>
            <Lamp lit={lampTurnLeft} blink tone="indicator" icon={ArrowBigLeft} label={t('driving.dash.turnSignal.left')} />
            <Lamp lit={lampLights} tone="indicator" icon={Lightbulb} label={t('driving.dash.lights')} />
          </ul>
          <WarningLamps snapshot={snapshot} inspect={inspect} />
          <ul className="operator-lamps" aria-label={t('driving.dash.indicators')}>
            <Lamp lit={lampBeacon} tone="caution" icon={Siren} label={t('driving.dash.beacon')} />
            <Lamp lit={lampTurnRight} blink tone="indicator" icon={ArrowBigRight} label={t('driving.dash.turnSignal.right')} />
          </ul>
          <Inspectable inspect={inspect} instrument="gauge.fuel" label={t('driving.dash.fuel')}>
            <Gauge label={t('driving.dash.fuel')} value={fuel} bands="fuel" icon={Fuel} />
          </Inspectable>
          <Inspectable inspect={inspect} instrument="gauge.temp" label={t('driving.dash.temp')}>
            <Gauge label={t('driving.dash.temp')} value={temp} bands="temp" icon={Thermometer} />
          </Inspectable>
          <Inspectable inspect={inspect} instrument="hours" label={t('driving.dash.hours')}>
            <span className="operator-hours" title={t('driving.dash.hours')}>
              {t('driving.dash.hoursValue', { hours: hours.toFixed(1) })}
            </span>
          </Inspectable>
        </div>
      </div>

      <div className="operator-panel operator-panel-cab">
        <div className="operator-toggles">
          <button
            type="button"
            className={`operator-switch ${seatbelt ? 'is-active' : ''} ${needSeatbelt ? 'is-required' : ''}`}
            aria-pressed={seatbelt}
            title={t('driving.dash.shortcut', { label: t('driving.dash.seatbelt'), key: 'B' })}
            onClick={() => dashboard.toggle('seatbelt')}
          >
            <SeatbeltIcon width={13} height={13} aria-hidden="true" /> {t('driving.dash.seatbelt')}
          </button>
          <button
            type="button"
            className={`operator-switch ${parkingBrake ? 'is-active' : ''} ${needParkingBrake ? 'is-required' : ''}`}
            aria-pressed={parkingBrake}
            title={t('driving.dash.shortcut', { label: t('driving.dash.parkingBrake'), key: 'Space' })}
            onClick={() => dashboard.toggle('parkingBrake')}
          >
            <CircleParking size={13} aria-hidden="true" /> {t('driving.dash.parkingBrake')}
          </button>
          <button type="button" className="operator-switch" title={t('driving.dash.shortcut', { label: t('driving.dash.horn'), key: 'H' })} onClick={() => dashboard.horn()}>
            <Megaphone size={13} aria-hidden="true" /> {t('driving.dash.horn')}
          </button>
          <button
            type="button"
            className={`operator-switch ${lights ? 'is-active' : ''}`}
            aria-pressed={lights}
            title={t('driving.dash.shortcut', { label: t('driving.dash.lights'), key: 'L' })}
            onClick={() => dashboard.toggle('lights')}
          >
            <Lightbulb size={13} aria-hidden="true" /> {t('driving.dash.lights')}
          </button>
          <button
            type="button"
            className={`operator-switch ${beacon ? 'is-active' : ''}`}
            aria-pressed={beacon}
            title={t('driving.dash.shortcut', { label: t('driving.dash.beacon'), key: 'O' })}
            onClick={() => dashboard.toggle('beacon')}
          >
            <Siren size={13} aria-hidden="true" /> {t('driving.dash.beacon')}
          </button>
          {/* The turn-signal stalk: one side or the other, the same side
              again to cancel. */}
          <div className="operator-signal" role="group" aria-label={t('driving.dash.turnSignal')}>
            {TURN_SIGNAL_SIDES.map(({ side, icon: Icon, key }) => (
              <button
                key={side}
                type="button"
                className={`operator-switch ${turnSignal === side ? 'is-active' : ''}`}
                aria-pressed={turnSignal === side}
                aria-label={t(`driving.dash.turnSignal.${side}`)}
                title={t('driving.dash.shortcut', { label: t(`driving.dash.turnSignal.${side}`), key })}
                onClick={() => dashboard.signal(side)}
              >
                <Icon size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="operator-levers" role="group" aria-label={t('driving.dash.hydraulics')}>
          <LeverIndicator label={t('driving.dash.liftLever')} value={liftInput} />
          <LeverIndicator label={t('driving.dash.tiltLever')} value={-tiltInput} />
          <AudioControl tone="plate" />
          <button type="button" className="operator-switch operator-drawer-toggle" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((open) => !open)}>
            {drawerOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronUp size={13} aria-hidden="true" />} {t('driving.dash.controls')}
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="operator-drawer">
          {[
            ...keyLegend.map(({ key, caption }) => ({ key: key.toUpperCase(), caption, live: key })),
            ...CAB_KEYS.map(({ key, captionKey }) => ({ key, caption: t(captionKey) })),
          ].map(({ key, caption, live }) => (
            <div key={key} className="driving-key-wrap">
              <span className={`driving-key ${live && pressed[live] ? 'active' : ''}`}>{key}</span>
              <span className="driving-key-caption">{caption}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
