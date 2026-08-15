import { Info } from 'lucide-react'
import './ScopeNoticeModal.css'

// The "preparatory learning only" disclaimer, as a dismiss-to-continue modal
// shown when a learner opens a module or the parts explorer. Deliberately
// not admin-editable - it is the scope statement, not content.
//
// The middle sentence is the only per-equipment part, and it is looked up
// here rather than passed in, so adding one for a new equipment is a single
// entry below instead of an edit to every page that shows this modal. An
// equipment with no entry gets the neutral wording - a Backhoe learner never
// reads a disclaimer about forklift classes.
const EQUIPMENT_SCOPE_NOTES = {
  forklift:
    'This module models a Class V (internal-combustion, pneumatic-tire) forklift. Other classes, makes, and models may differ in layout, controls, and inspection points.',
}

const DEFAULT_SCOPE_NOTE =
  'The 3D model shown is one representative make and model - actual equipment may differ in layout, controls, and inspection points.'

function ScopeNoticeModal({ equipmentId, onDismiss }) {
  const note = EQUIPMENT_SCOPE_NOTES[equipmentId] || DEFAULT_SCOPE_NOTE

  return (
    <div className="scope-notice-modal-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="scope-notice-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="scope-notice-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <Info size={22} className="scope-notice-modal-icon" aria-hidden="true" />
        <strong id="scope-notice-modal-title">Preparatory learning only</strong>
        <p>
          GearView3D is a familiarization tool and not a certification simulator. {note} Always refer to the
          manufacturer's operator manual and your site's equipment-specific procedures before operating actual
          equipment.
        </p>
        <button type="button" className="scope-notice-modal-dismiss" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  )
}

export default ScopeNoticeModal
