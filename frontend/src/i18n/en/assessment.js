// The final-check review page. Module titles, part labels and quiz names are
// admin-authored rows and stay as written.
//
// Every "N of M" form here is a whole sentence with named tokens rather than a
// number glued to a translated word: the clause order differs between the two
// languages, so a shared "of" between two numbers cannot work.
export default {
  'assessment.pageTitle': '{equipment} assessment',
  'assessment.back': 'Back to modules',
  'assessment.heading': '{equipment} - Final assessment',
  'assessment.kicker': 'Progress review',
  'assessment.status.complete': 'Prototype module completion',
  'assessment.status.inProgress': 'Training still in progress',
  'assessment.intro': 'This page summarizes GearView3D learner progress for thesis demonstration. The completion badge is only for prototype module completion and does not imply official TESDA certification.',
  'assessment.learnerFallback': 'Learner',
  'assessment.noEmail': 'No email on file',

  'assessment.stat.overall': 'Overall',
  'assessment.stat.modules': 'Modules',
  'assessment.stat.parts': 'Parts identification',

  'assessment.modules.heading': 'Module review',
  'assessment.modules.loading': 'Loading modules...',
  'assessment.modules.empty': 'No modules yet.',
  'assessment.modules.row': '{module}: {completed}/{total} checklist items, quiz {quiz}',
  'assessment.modules.rowNoChecklist': '{module}: no checklist items, quiz {quiz}',
  'assessment.quiz.notAttempted': 'not attempted',
  'assessment.quiz.scored': '{score}/{total}',

  'assessment.parts.heading': 'Parts review',
  'assessment.parts.loading': 'Loading parts...',
  'assessment.parts.viewedCount': '{viewed} of {total} parts viewed.',
  'assessment.parts.row': '{part}: {state}',
  'assessment.parts.viewed': 'viewed',
  'assessment.parts.notViewed': 'not viewed',

  'assessment.scores.heading': 'Quiz scores',
  'assessment.scores.empty': 'No quiz attempts saved yet.',
  'assessment.scores.row': '{module}: {score}/{total} ({percentage}%)',

  'assessment.next.heading': 'Recommended next action',
  'assessment.next.ready': 'Ready for instructor review or thesis demo presentation.',
  'assessment.next.parts': 'Review remaining parts on the 3D model.',
  'assessment.next.modules': 'Continue training modules and checklists.',
  'assessment.next.partsQuiz': 'Parts quiz: {result}.',
  'assessment.next.partsQuizScored': '{score}/{total} ({percentage}%)',

  'assessment.badge': 'GearView3D training completion',
  'assessment.action.modules': 'Review training modules',
  'assessment.action.parts': 'Review parts identification',
}
