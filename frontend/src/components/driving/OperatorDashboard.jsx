import { useState } from 'react'
import {
  BatteryWarning,
  ChevronDown,
  ChevronUp,
  CircleParking,
  Droplet,
  Fuel,
  Lightbulb,
  Megaphone,
  PackageX,
  Thermometer,
  Weight,
} from 'lucide-react'
import { useT } from '../../i18n'
import { useTelemetry } from '../../hooks/useTelemetry'
import { KEY_POSITIONS } from '../../lib/driving/dashboardSource'
import { GRIP_LABEL_KEYS } from '../../lib/driving/constants'
import { DIRECTIONS } from '../../lib/driving/controls'
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
// the right. Lamps light only with the key on, as a real cluster's do. The
// oil-pressure and charge lamps are lit with the key on and the engine
// stopped, which is the bulb check an operator does before cranking.

const CAB_KEYS = [
  { key: 'C', captionKey: 'driving.key.cameraNext' },
  { key: '1-5', captionKey: 'driving.key.cameraJump' },
  { key: 'V', captionKey: 'driving.key.inset' },
  { key: 'H', captionKey: 'driving.key.horn' },
  { key: 'B', captionKey: 'driving.key.seatbelt' },
  { key: 'Space', captionKey: 'driving.key.parkingBrake' },
]

const wholeSnapshot = (snapshot) => snapshot

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

// A warning lamp: a symbol that lights, named for screen readers and on
// hover, read at a glance like a real cluster's.
function Lamp({ lit, tone, label, icon: Icon }) {
  const t = useT()
  return (
    <li
      className={`operator-lamp ${tone} ${lit ? 'is-lit' : ''}`}
      title={label}
      aria-label={t(lit ? 'driving.dash.lampState.on' : 'driving.dash.lampState.off', { lamp: label })}
    >
      <Icon width={15} height={15} aria-hidden="true" />
    </li>
  )
}

function Gauge({ label, value, bands, icon: Icon }) {
  return (
    <div className="operator-gauge" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} title={label}>
      <Icon width={12} height={12} aria-hidden="true" />
      <span className={`operator-gauge-track ${bands}`} aria-hidden="true">
        <span className="operator-gauge-needle" style={{ left: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
      </span>
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

export function OperatorDashboard({ telemetry, dashboard, capacityKg, keyLegend, pressed }) {
  const t = useT()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Nearly every field is on show, and the store only replaces the snapshot
  // when something in it changed, so the cluster reads it whole.
  const {
    engineOn, keyPosition, direction, leverEngaged, seatbelt, parkingBrake, lights,
    speedKmh, forkHeightM, tiltDeg, tilt, grip, palletState, carriedLoadKg,
    fuel, temp, hours, liftInput, tiltInput,
  } = useTelemetry(telemetry, wholeSnapshot)

  const powered = engineOn || keyPosition === 'on'
  const hasCapacity = typeof capacityKg === 'number'
  const overloaded = hasCapacity && carriedLoadKg != null && carriedLoadKg > capacityKg
  const loadInsecure = palletState === 'carried' && grip !== 'secure'

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

        <fieldset className="operator-group">
          <legend>{t('driving.dash.lever')}</legend>
          {DIRECTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={`operator-switch ${leverEngaged && direction === value ? 'is-active' : ''}`}
              aria-pressed={leverEngaged && direction === value}
              onClick={() => dashboard.setLever(value)}
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            className={`operator-switch ${leverEngaged ? '' : 'is-active'}`}
            aria-pressed={!leverEngaged}
            title={t('driving.dash.lever.autoHint')}
            onClick={() => dashboard.releaseLever()}
          >
            {t('driving.dash.lever.auto')}
          </button>
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

          {hasCapacity && (
            <div className={`operator-readout ${overloaded ? 'is-danger' : ''}`}>
              <span className="operator-readout-value small">
                {carriedLoadKg != null
                  ? t('driving.dash.loadValue', { load: carriedLoadKg.toLocaleString(), capacity: capacityKg.toLocaleString() })
                  : t('driving.dash.noLoad', { capacity: capacityKg.toLocaleString() })}
              </span>
              <span className="operator-readout-label">{t('driving.dash.load')}</span>
            </div>
          )}

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
          <ul className="operator-lamps" aria-label={t('driving.dash.lamps')}>
            <Lamp lit={powered && parkingBrake} tone="danger" icon={CircleParking} label={t('driving.dash.lamp.parkingBrake')} />
            <Lamp lit={powered && !seatbelt} tone="danger" icon={SeatbeltIcon} label={t('driving.dash.lamp.seatbelt')} />
            <Lamp lit={keyPosition === 'on' && !engineOn} tone="danger" icon={Droplet} label={t('driving.dash.lamp.oil')} />
            <Lamp lit={keyPosition === 'on' && !engineOn} tone="danger" icon={BatteryWarning} label={t('driving.dash.lamp.charge')} />
            <Lamp lit={powered && overloaded} tone="danger" icon={Weight} label={t('driving.dash.lamp.overload')} />
            <Lamp lit={powered && loadInsecure} tone="caution" icon={PackageX} label={t('driving.dash.lamp.loadInsecure')} />
          </ul>
          <Gauge label={t('driving.dash.fuel')} value={fuel} bands="fuel" icon={Fuel} />
          <Gauge label={t('driving.dash.temp')} value={temp} bands="temp" icon={Thermometer} />
          <span className="operator-hours" title={t('driving.dash.hours')}>
            {t('driving.dash.hoursValue', { hours: hours.toFixed(1) })}
          </span>
        </div>
      </div>

      <div className="operator-panel operator-panel-cab">
        <div className="operator-toggles">
          <button
            type="button"
            className={`operator-switch ${seatbelt ? 'is-active' : ''}`}
            aria-pressed={seatbelt}
            title={t('driving.dash.shortcut', { label: t('driving.dash.seatbelt'), key: 'B' })}
            onClick={() => dashboard.toggle('seatbelt')}
          >
            <SeatbeltIcon width={13} height={13} aria-hidden="true" /> {t('driving.dash.seatbelt')}
          </button>
          <button
            type="button"
            className={`operator-switch ${parkingBrake ? 'is-active' : ''}`}
            aria-pressed={parkingBrake}
            title={t('driving.dash.shortcut', { label: t('driving.dash.parkingBrake'), key: 'Space' })}
            onClick={() => dashboard.toggle('parkingBrake')}
          >
            <CircleParking size={13} aria-hidden="true" /> {t('driving.dash.parkingBrake')}
          </button>
          <button type="button" className="operator-switch" title={t('driving.dash.shortcut', { label: t('driving.dash.horn'), key: 'H' })} onClick={() => dashboard.horn()}>
            <Megaphone size={13} aria-hidden="true" /> {t('driving.dash.horn')}
          </button>
          <button type="button" className={`operator-switch ${lights ? 'is-active' : ''}`} aria-pressed={lights} onClick={() => dashboard.toggle('lights')}>
            <Lightbulb size={13} aria-hidden="true" /> {t('driving.dash.lights')}
          </button>
        </div>
        <div className="operator-levers" role="group" aria-label={t('driving.dash.hydraulics')}>
          <LeverIndicator label={t('driving.dash.liftLever')} value={liftInput} />
          <LeverIndicator label={t('driving.dash.tiltLever')} value={-tiltInput} />
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
