import MarkdownContent from './MarkdownContent'
import { useT } from '../i18n'
import './ModuleBriefing.css'

// A briefing step is data, not code: `content` comes from the Course row an
// admin edits ({ image, sceneBody, body, showSyllabus, syllabus, objectives }).
// The centre panel shows a reference image and/or markdown; the task panel
// shows the module's syllabus card and the lesson markdown. `objectives` is
// read by the page, not here - it feeds the shell's sidebar. The scope notice
// used to live inline here; it is now the dismiss-to-continue modal
// GenericModulePage shows when the module first opens (see ScopeNoticeModal).

export function BriefingScene({ content }) {
  const t = useT()

  const image = content?.image
  const sceneBody = content?.sceneBody

  if (!image && !sceneBody) {
    return (
      <div className="module-briefing-scene is-empty">
        <p>{t('module.briefing.empty')}</p>
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
  const t = useT()

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
          {syllabus.location && <p><strong>{t('module.syllabus.location')}</strong> {syllabus.location}</p>}
          {syllabus.unitCode && <p><strong>{t('module.syllabus.unitCode')}</strong> {syllabus.unitCode}</p>}
          {syllabus.element && <p><strong>{t('module.syllabus.element')}</strong> {syllabus.element}</p>}
          {syllabus.pageReferences && <p><strong>{t('module.syllabus.pageReferences')}</strong> {syllabus.pageReferences}</p>}
        </div>
      )}
      <MarkdownContent className="module-briefing-body">{content?.body}</MarkdownContent>
    </div>
  )
}
