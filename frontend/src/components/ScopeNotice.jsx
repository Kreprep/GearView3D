import { Info } from 'lucide-react'
import './ScopeNotice.css'

// The "preparatory learning only" disclaimer. Deliberately *not* admin-editable:
// it is the scope statement, not content.
//
// The middle sentence is the only per-equipment part, and it is looked up here
// rather than passed in, so adding one for a new equipment is a single entry
// below instead of an edit to every page that renders this. An equipment with
// no entry gets the neutral wording - a Backhoe learner never reads a
// disclaimer about forklift classes.
const EQUIPMENT_SCOPE_NOTES = {
  forklift:
    'This module models a Class V (internal-combustion, pneumatic-tire) forklift. Other classes, makes, and models may differ in layout, controls, and inspection points.',
}

const DEFAULT_SCOPE_NOTE =
  'The 3D model shown is one representative make and model - actual equipment may differ in layout, controls, and inspection points.'

function scopeNoteFor(equipmentId) {
  return EQUIPMENT_SCOPE_NOTES[equipmentId] || DEFAULT_SCOPE_NOTE
}

function ScopeNotice({ equipmentId }) {
  return (
    <section className="scope-notice" aria-label="Training scope notice">
      <Info size={18} className="scope-notice-icon" aria-hidden="true" />
      <div>
        <strong>Preparatory learning only</strong>
        <p>
          GearView3D is a familiarization tool and not a certification simulator. {scopeNoteFor(equipmentId)} Always
          refer to the manufacturer's operator manual and your site's equipment-specific procedures before operating
          actual equipment.
        </p>
      </div>
    </section>
  )
}

export default ScopeNotice
