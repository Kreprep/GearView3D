import { Info } from 'lucide-react'
import { useT } from '../i18n'
import './ScopeNoticeModal.css'

// The "preparatory learning only" disclaimer, as a dismiss-to-continue modal
// shown when a learner opens a module or the parts explorer. Deliberately
// not admin-editable - it is the scope statement, not content.
function ScopeNoticeModal({ onDismiss }) {
  const t = useT()

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
        <p>{t('scope.body')}</p>
        <button type="button" className="scope-notice-modal-dismiss" onClick={onDismiss}>
          {t('scope.dismiss')}
        </button>
      </div>
    </div>
  )
}

export default ScopeNoticeModal
