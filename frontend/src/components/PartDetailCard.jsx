import MarkdownContent from './MarkdownContent'
import './PartDetailCard.css'

/**
 * Standard "Part Details" card used everywhere a part/hotspot is clicked
 * (walk-around style modules and Parts Identification). Renders the reference
 * image slot, title, subtitle, a markdown description, and an optional
 * status/feedback line.
 */
function PartDetailCard({ title, subtitle, image, description, status, statusType }) {
  return (
    <div className="hotspot-detail">
      {image ? (
        <img className="hotspot-detail-image" src={image} alt={title || 'Part reference'} />
      ) : (
        <div className="hotspot-detail-image hotspot-detail-image-placeholder">No reference image yet</div>
      )}
      {title && <h3>{title}</h3>}
      {subtitle && <p className="hotspot-detail-subtitle">{subtitle}</p>}
      <MarkdownContent>{description}</MarkdownContent>
      {status && <p className={`hotspot-detail-status ${statusType || 'neutral'}`}>{status}</p>}
    </div>
  )
}

export default PartDetailCard
