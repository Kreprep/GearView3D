import { Info } from 'lucide-react'
import { useT } from '../i18n'
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
// A key map, not a sentence map, so "one entry per new equipment" still holds
// once the sentences themselves live in the catalog.
const EQUIPMENT_SCOPE_NOTE_KEYS = {
  forklift: 'scope.note.forklift',
}

const DEFAULT_SCOPE_NOTE_KEY = 'scope.note.default'

function ScopeNoticeModal({ equipmentId, onDismiss }) {
  const t = useT()
  const note = t(EQUIPMENT_SCOPE_NOTE_KEYS[equipmentId] || DEFAULT_SCOPE_NOTE_KEY)

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
        <strong id="scope-notice-modal-title">{t('scope.title')}</strong>
        {/* One key with a {note} token rather than three nodes: the body
            interleaves two fixed sentences around the per-equipment one, and
            the languages do not put them in the same order. */}
        <p>{t('scope.body', { note })}</p>
        <button type="button" className="scope-notice-modal-dismiss" onClick={onDismiss}>
          {t('scope.dismiss')}
        </button>
      </div>
    </div>
  )
}

export default ScopeNoticeModal
