import { Info } from 'lucide-react'
import './ScopeNotice.css'

function ScopeNotice() {
  return (
    <section className="scope-notice" aria-label="Training scope notice">
      <Info size={18} className="scope-notice-icon" aria-hidden="true" />
      <div>
        <strong>Preparatory learning only</strong>
        <p>
          GearView3D is a familiarization tool and not a certification simulator. This module models a Class V
          (internal-combustion, pneumatic-tire) forklift. Other classes, makes, and models may differ in layout,
          controls, and inspection points. Always refer to the manufacturer's operator manual and your site's
          equipment-specific procedures before operating actual equipment.
        </p>
      </div>
    </section>
  )
}

export default ScopeNotice
