import { useT } from '../../i18n'
import { useTelemetry } from '../../hooks/useTelemetry'
import './SafetySigns.css'

// The safety signs (docs/revisions/post-defense-plan.md, section 4.5): what
// the rules in lib/driving/safetyRules.js raise, shown at the bottom centre
// of the driving screen, just above the operator dashboard. At most two at a
// time, the most severe on top; the alert queue has already debounced them,
// so whatever is in the store is drawn as it is.
//
// The signs use the ISO 7010 vocabulary the rest of the app's design takes
// its status colours from: a yellow triangle warns, a blue disc says what
// must be done, a red ring says what must not. The pictograms are our own
// simple drawings in that style, not copies of ISO artwork. They sit in a
// 24-unit box and are stroked in the sign's own ink colour.

const PICTOGRAMS = {
  // The general warning mark: it has to read at a glance inside a triangle.
  obstacle: <path d="M12 3.5v10M12 19.5v.5" strokeWidth="3.4" />,
  // No further: the bar of a no-entry sign.
  stop: <path d="M6 12h12" strokeWidth="4.5" />,
  // The truck from above, its tail swinging out.
  'tail-swing': (
    <>
      <rect x="6.5" y="3.5" width="6" height="12" rx="1" />
      <path d="M12.5 18.5c4 0 6.5-2.5 6.5-6.5M16.5 13.5 19 12l1.5 2.5" />
    </>
  ),
  // A weight.
  overload: (
    <>
      <circle cx="12" cy="6" r="2.2" />
      <path d="M8.5 9.5h7L19 20H5z" />
    </>
  ),
  // The truck from behind, going over.
  'tip-over': (
    <>
      <path d="M7.5 17.5 5 8.5l8.5-2.3 2.4 9" />
      <path d="M3.5 20h17M17 9.5c2 .8 3 2.6 3 4.6M18 15.2l2 .9 1-2" />
    </>
  ),
  // A load sliding along the tines.
  'load-shift': (
    <>
      <path d="M4 5v13h16" />
      <rect x="9" y="9.5" width="6.5" height="6.5" rx="0.5" />
      <path d="M17.5 12.8h3.5M19 10.8l2 2-2 2" />
    </>
  ),
  // A seated figure with a belt across it (as on the dashboard's lamp).
  seatbelt: (
    <>
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M8 21v-7a4 4 0 0 1 8 0v7M8.5 10.5 16 19" />
    </>
  ),
  'parking-brake': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 17V7.5h2.8a2.9 2.9 0 0 1 0 5.8H10" />
    </>
  ),
  neutral: <path d="M7.5 18V6l9 12V6" />,
  // A turn back the way the truck is going.
  'look-behind': (
    <>
      <path d="M7 5h7a5 5 0 0 1 0 10H6" />
      <path d="M9.5 11.5 6 15l3.5 3.5" />
    </>
  ),
  turn: (
    <>
      <path d="M6 20v-8a5 5 0 0 1 5-5h7" />
      <path d="M15 3.5 18.5 7 15 10.5" />
    </>
  ),
  // Forward and reverse.
  direction: <path d="M8 19V5M4.5 8.5 8 5l3.5 3.5M16 5v14M12.5 15.5 16 19l3.5-3.5" />,
  // A fork, and the way down.
  'forks-low': (
    <>
      <path d="M5 4v15h9" />
      <path d="M18 5v9M14.8 11l3.2 3.2 3.2-3.2" />
    </>
  ),
  // The mast, leaning back toward the operator.
  'mast-back': (
    <>
      <path d="M11 19h9M11 19 8 5" />
      <path d="M19 8h-6M15.5 5.5 13 8l2.5 2.5" />
    </>
  ),
  // The mast leaning forward under a load.
  'tilt-forward': (
    <>
      <path d="M6 19h11M6 19 9 5" />
      <rect x="10.5" y="11" width="6" height="6" rx="0.5" />
    </>
  ),
  // A fork, and the lift lever's two ways.
  lift: (
    <>
      <path d="M4 4v15h8" />
      <path d="M17.5 5v14M14.5 8l3-3 3 3M14.5 16l3 3 3-3" />
    </>
  ),
  // Tines only part of the way into a pallet.
  'forks-insert': (
    <>
      <rect x="11" y="7" width="9.5" height="10" rx="0.5" />
      <path d="M3 10.5h11M3 13.5h11" />
    </>
  ),
}

// The ISO 7010 frame for each kind of sign, in a 48-unit box, with where its
// pictogram goes. A triangle has less room than a disc, low down.
const FRAMES = {
  warning: {
    className: 'warning',
    shape: <path d="M24 5 45 42H3z" strokeLinejoin="round" />,
    pictogram: 'translate(14.4 19.5) scale(0.8)',
  },
  mandatory: {
    className: 'mandatory',
    shape: <circle cx="24" cy="24" r="21" />,
    pictogram: 'translate(10.8 10.8) scale(1.1)',
  },
  prohibition: {
    className: 'prohibition',
    shape: <circle cx="24" cy="24" r="19" />,
    pictogram: 'translate(12 12)',
    bar: <path d="M10.6 10.6 37.4 37.4" />,
  },
}

// A stop sign and a speed limit are red rings that stand on their own: no
// bar across them.
const UNBARRED = ['stop', 'speed-limit']

function SignSymbol({ sign }) {
  const frame = FRAMES[sign.kind]
  const isStop = sign.pictogram === 'stop'
  return (
    <svg className={`safety-sign-symbol ${frame.className} ${isStop ? 'solid' : ''}`} viewBox="0 0 48 48" aria-hidden="true">
      <g className="safety-sign-frame">{frame.shape}</g>
      {sign.pictogram === 'speed-limit' ? (
        <text className="safety-sign-number" x="24" y="24" textAnchor="middle" dominantBaseline="central">
          {sign.values.limit}
        </text>
      ) : (
        <g className="safety-sign-pictogram" transform={frame.pictogram}>
          {PICTOGRAMS[sign.pictogram]}
        </g>
      )}
      {frame.bar && !UNBARRED.includes(sign.pictogram) && <g className="safety-sign-bar">{frame.bar}</g>}
    </svg>
  )
}

const signsOf = (snapshot) => snapshot.signs

// `store` holds { signs }: the alert queue's `shown` list (a telemetry store,
// lib/driving/telemetry.js), published from the frame loop.
export function SafetySigns({ store }) {
  const t = useT()
  const signs = useTelemetry(store, signsOf)

  return (
    <ul className="safety-signs" aria-label={t('safety.signs.label')}>
      {signs.map((sign) => {
        const message = t(sign.messageKey, sign.values)
        return (
          // Keyed by rule, so a sign that changes what it says (caution to
          // stop, one interlock item to the next) stays the same element.
          <li
            key={sign.id}
            className={`safety-sign ${sign.severity}`}
            data-rule={sign.id}
            role={sign.severity === 'danger' ? 'alert' : 'status'}
            aria-label={t('safety.sign.announce', { severity: t(`safety.severity.${sign.severity}`), message })}
          >
            <SignSymbol sign={sign} />
            <span className="safety-sign-message">{message}</span>
          </li>
        )
      })}
    </ul>
  )
}
