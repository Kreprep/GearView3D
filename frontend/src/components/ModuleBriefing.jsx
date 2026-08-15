import MarkdownContent from './MarkdownContent'
import './ModuleBriefing.css'

// A briefing step is data, not code: `content` comes from the Course row an
// admin edits ({ image, sceneBody, body, showSyllabus, syllabus, objectives }).
// The centre panel shows a reference image and/or markdown; the task panel
// shows the module's syllabus card and the lesson markdown. `objectives` is
// read by the page, not here - it feeds the shell's sidebar. The scope notice
// used to live inline here; it is now the dismiss-to-continue modal
// GenericModulePage shows when the module first opens (see ScopeNoticeModal).

export function BriefingScene({ content }) {
  const image = content?.image
  const sceneBody = content?.sceneBody

  if (!image && !sceneBody) {
    return (
      <div className="module-briefing-scene is-empty">
        <p>This briefing has no reference image or panel text yet.</p>
      </div>
    )
  }

  return (
    <div className="module-briefing-scene">
      {image && <img className="module-briefing-image" src={image} alt="" />}
      {sceneBody && <MarkdownContent className="module-briefing-panel">{sceneBody}</MarkdownContent>}
    </div>
  )
}

export function BriefingTask({ content, module }) {
  // Rows seeded before the syllabus became editable have no `syllabus` object,
  // so each field falls back to the static module definition.
  const syllabus = {
    location: content?.syllabus?.location || module?.syllabusLocation || '',
    unitCode: content?.syllabus?.unitCode || module?.unitCode || '',
    element: content?.syllabus?.element || module?.element || '',
    pageReferences: content?.syllabus?.pageReferences || module?.pageReferences || '',
  }
  const showSyllabus = content?.showSyllabus !== false && Object.values(syllabus).some(Boolean)

  return (
    <div className="load-task-stack">
      {showSyllabus && (
        <div className="reference-card">
          {syllabus.location && <p><strong>Syllabus Location:</strong> {syllabus.location}</p>}
          {syllabus.unitCode && <p><strong>Unit Code:</strong> {syllabus.unitCode}</p>}
          {syllabus.element && <p><strong>Element:</strong> {syllabus.element}</p>}
          {syllabus.pageReferences && <p><strong>Page References:</strong> {syllabus.pageReferences}</p>}
        </div>
      )}
      <MarkdownContent className="module-briefing-body">{content?.body}</MarkdownContent>
    </div>
  )
}
