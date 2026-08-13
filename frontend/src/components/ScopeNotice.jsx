import { Info } from 'lucide-react'
import './ScopeNotice.css'

// The equipment-specific sentence for Forklift pages. Non-Forklift pages leave
// `note` unset and get the neutral wording, so a Backhoe learner never reads a
// disclaimer about forklift classes.
export const FORKLIFT_SCOPE_NOTE =
  'This module models a Class V (internal-combustion, pneumatic-tire) forklift. Other classes, makes, and models may differ in layout, controls, and inspection points.'

const DEFAULT_SCOPE_NOTE =
  'The 3D model shown is one representative make and model - actual equipment may differ in layout, controls, and inspection points.'

function ScopeNotice({ note }) {
  return (
    <section className="scope-notice" aria-label="Training scope notice">
      <Info size={18} className="scope-notice-icon" aria-hidden="true" />
      <div>
        <strong>Preparatory learning only</strong>
        <p>
          GearView3D is a familiarization tool and not a certification simulator. {note || DEFAULT_SCOPE_NOTE} Always
          refer to the manufacturer's operator manual and your site's equipment-specific procedures before operating
          actual equipment.
        </p>
      </div>
    </section>
  )
}

export default ScopeNotice
