// components/Quiz.jsx, which serves both a module's quiz step and the parts
// quiz. Questions, options and answers are admin-authored
// QuizQuestion rows and stay as written.
export default {
  'quiz.defaultTitle': 'Short quiz',
  'quiz.intro': 'Answer the questions below. Your latest attempt is saved automatically after submission.',
  'quiz.latest': 'Latest: {score}/{total}',
  'quiz.noAttempt': 'No attempt yet',
  'quiz.empty': 'No quiz questions are available yet.',
  'quiz.empty.module': 'No quiz questions are available for this module yet.',
  'quiz.empty.parts': 'No quiz questions have been added for the parts page yet.',
  'quiz.correct': 'Correct.',
  // Whole sentence with a token: the answer sits mid-sentence in English and
  // the clause order differs in Filipino, so this cannot be glued together.
  'quiz.incorrect': 'Incorrect. Correct answer: {answer}.',
  'quiz.submit': 'Submit quiz',
  'quiz.submitting': 'Submitting...',
  'quiz.retry': 'Retry',
  'quiz.result': 'Result: {score}/{total} ({percentage}%)',
}
