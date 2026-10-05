// The Final Driving Test's scorecard and pass rules (lib/missionScore.js,
// components/driving/MissionScorecard.jsx) and its line on the assessment
// page. A rule is named by its `safety.rule.<id>` phrase, the same one the
// attempt summary uses.
export default {
  'mission.rules.heading': 'To pass',
  'mission.rules.noDanger': 'No danger-level safety sign.',
  'mission.rules.maxCautions.one': 'No more than {count} caution sign.',
  'mission.rules.maxCautions.other': 'No more than {count} caution signs.',
  'mission.rules.noCautions': 'No caution signs.',
  'mission.rules.clean': 'Not once: {list}.',

  'mission.result.heading': 'Your last run',
  'mission.result.passed': 'Passed',
  'mission.result.failed': 'Not passed',
  'mission.result.score': 'Score {score} / 100',
  'mission.result.time': 'Time on the course: {minutes} min {seconds} s',
  'mission.result.best': 'Best passing score: {score} / 100',
  'mission.result.passedEarlier': 'You passed this test on {date}.',
  'mission.result.fails.one': '{count} failed attempt before this pass.',
  'mission.result.fails.other': '{count} failed attempts before this pass.',
  'mission.result.retry': 'Use Reset attempt to try again.',

  'mission.reason.dangers.one': '{count} danger sign came up.',
  'mission.reason.dangers.other': '{count} danger signs came up.',
  'mission.reason.cautions.one': '{count} caution sign came up; at most {max} allowed.',
  'mission.reason.cautions.other': '{count} caution signs came up; at most {max} allowed.',
  'mission.reason.cleanRule': 'Not allowed at all: {rule}.',

  'mission.signs.heading': 'Safety signs on this run',
  'mission.signs.none': 'No safety signs on this run.',
  'mission.signs.cautions.one': '{count} caution',
  'mission.signs.cautions.other': '{count} cautions',
  'mission.signs.dangers.one': '{count} danger',
  'mission.signs.dangers.other': '{count} dangers',
  'mission.signs.penalty': '−{points}',
  'mission.signs.penaltyLabel': '{points} points off',

  'mission.assessment.heading': 'Final driving test',
  'mission.assessment.passed': '{module}: passed, best score {score} / 100.',
  'mission.assessment.notPassed': '{module}: not passed yet. Last run scored {score} / 100.',
}
