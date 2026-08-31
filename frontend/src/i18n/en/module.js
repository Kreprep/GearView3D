// The module shell every step of every module renders inside, plus the step
// kinds that have no namespace of their own (checklist, quiz intro, the two
// built-in activities, the summary).
//
// Lesson content itself - module titles, briefing markdown, step hints,
// objectives, checklist items, quiz questions - is admin-authored and stays in
// whatever language it was written in.
export default {
  'module.kicker': 'Guided simulation',
  'module.progress': 'Progress',
  'module.score': 'Score: {score}',
  'module.progressLabel': 'Simulation progress {percent}%',

  'module.panel.objectives': 'Objectives',
  'module.panel.steps': 'Steps',
  'module.panel.partDetails': 'Part details',
  'module.panel.currentTask': 'Current task',
  'module.panel.summary': 'Completion summary',

  'module.hint.show': 'Show hint',
  'module.hint.hide': 'Hide hint',
  'module.hint.none': 'No hint is available for this step.',

  'module.scene.placeholderTitle': 'Interactive task area',
  'module.scene.placeholderBody': '3D viewer, diagram, or activity scene will appear here.',

  'module.nav.back': 'Back',
  'module.nav.next': 'Next',
  'module.nav.complete': 'Complete module',

  'module.rows.quizNote': 'Answer the questions, then use Next to continue.',
  'module.rows.checklistNote': 'Tick each item as you complete it, then use Next to continue.',
  'module.activity.report': 'Report',
  'module.activity.noAction': 'No action',
  'module.activity.tryAgain': '{feedback} Try again.',
  'module.briefing.empty': 'This briefing has no reference image or panel text yet.',
  'module.syllabus.location': 'Syllabus location:',
  'module.syllabus.unitCode': 'Unit code:',
  'module.syllabus.element': 'Element:',
  'module.syllabus.pageReferences': 'Page references:',
  'module.summary.complete': 'Complete',
  'module.summary.open': 'Open',
  'module.summary.allComplete': 'All requirements are complete.',
  'module.summary.incomplete': 'Complete every graded step to finish this module.',
  'module.checklist.kicker': 'Guided activity',
  'module.checklist.error': 'Checklist could not be loaded: {error}',
  'module.backToModules': 'Back to modules',
  'module.loadingSteps': 'Loading module steps...',
  'module.loadError': "This module's steps could not be loaded.",
  'module.empty': 'This module has no steps yet. An admin can add one from the Courses tab.',
  'module.task.completeRequirements': "Complete this step's requirements, then continue.",
}
