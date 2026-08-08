// Parts Identification practice questions.
//
// Split out of partsData.js for the same reason as moduleQuizzes.js: each
// question carries its correct `answer`, and partsData.js is imported by the
// page for its hotspots. This file is imported by the seed only; at runtime
// the questions come from the PracticeQuestion table without their answers.
export const partsPracticeQuestions = [
  {
    id: 'select-capacity-plate',
    prompt: 'Which part shows the rated load capacity and forklift specifications?',
    options: ['Capacity Plate', 'Counterweight', 'Operator Area', 'Mast'],
    answer: 'Capacity Plate',
  },
  {
    id: 'balance-part',
    prompt: 'Which part balances the forklift?',
    options: ['Counterweight', 'Forks', 'Warning Devices', 'Lift Chain'],
    answer: 'Counterweight',
  },
  {
    id: 'load-support',
    prompt: 'Which part supports the pallet or load?',
    options: ['Forks', 'Tires', 'Overhead Guard', 'Capacity Plate'],
    answer: 'Forks',
  },
  {
    id: 'operator-controls',
    prompt: 'Which area contains the operator controls?',
    options: ['Operator Area', 'Carriage', 'Mast', 'Counterweight'],
    answer: 'Operator Area',
  },
  {
    id: 'warning-devices',
    prompt: 'Which devices include lights, horn, and backup alarm?',
    options: ['Warning Devices', 'Forks', 'Lift Chain', 'Tires'],
    answer: 'Warning Devices',
  },
  {
    id: 'raises-forks',
    prompt: 'Which part raises and lowers the forks?',
    options: ['Mast', 'Counterweight', 'Capacity Plate', 'Tires'],
    answer: 'Mast',
  },
  {
    id: 'connects-forks',
    prompt: 'Which part connects the forks to the mast?',
    options: ['Carriage', 'Overhead Guard', 'Operator Area', 'Warning Devices'],
    answer: 'Carriage',
  },
]

// Seed rows for the PracticeQuestion table.
export function buildDefaultPracticeQuestions() {
  return partsPracticeQuestions.map((question, index) => ({
    id: question.id,
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    sortOrder: index + 1,
  }))
}
