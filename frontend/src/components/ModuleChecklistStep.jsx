import GuidedChecklist from './GuidedChecklist'
import { useT } from '../i18n'
import MarkdownContent from './MarkdownContent'
import Quiz from './Quiz'
import './ModuleChecklistStep.css'

// The `checklist` and `quiz` step kinds. Unlike every other kind, these render
// rows that belong to the *module* rather than to the step: the module's
// ChecklistItem / QuizQuestion rows, edited in their own dashboard tabs. The
// step itself only carries the intro copy in `content.body`, which is why an
// admin can drop the same kind into a module only once usefully.

export function ChecklistScene({ content, moduleSlug, title }) {
  return (
    <div className="module-rows-scene">
      <MarkdownContent className="module-rows-intro">{content?.body}</MarkdownContent>
      <GuidedChecklist moduleSlug={moduleSlug} title={title} />
    </div>
  )
}

export function QuizScene({ content, moduleSlug, title }) {
  const t = useT()

  return (
    <div className="module-rows-scene">
      <MarkdownContent className="module-rows-intro">{content?.body}</MarkdownContent>
      <Quiz scope={{ module: moduleSlug }} title={title} emptyMessage={t('quiz.empty.module')} />
    </div>
  )
}

// Both kinds are ungraded: they record their own progress (checklist items and
// quiz attempts) but do not gate Next, so a learner is never stuck on a quiz.
export function ModuleRowsTask({ content, kind }) {
  const t = useT()
  const fallback = t(kind === 'quiz' ? 'module.rows.quizNote' : 'module.rows.checklistNote')

  return (
    <div className="load-task-stack">
      <p className="task-note">
        {(kind === 'quiz' ? content?.passMessage : content?.completeMessage) || fallback}
      </p>
    </div>
  )
}
