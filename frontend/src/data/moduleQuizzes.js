// Module quiz questions, keyed by module slug.
//
// Split out of trainingModules.js because each question carries its correct
// `answer`. The pages import equipmentUsageModules, so anything nested inside
// it ends up in the browser bundle - the answer key included. This file is
// imported by the seed only; at runtime the questions come from the
// QuizQuestion table via /api/content/quizzes/:slug, which withholds the
// answer until the learner submits and the server scores the attempt.
export const moduleQuizQuestions = {
  'walk-around-check': [
    {
      id: 'walk-fluid-leaks',
      prompt: 'What should be checked during a walk-around inspection?',
      options: ['Fluid leaks', 'Lunch schedule', 'Paint color', 'Radio volume'],
      answer: 'Fluid leaks',
    },
    {
      id: 'walk-warning-devices',
      prompt: 'Which devices should be tested before operation?',
      options: ['Horn and lights', 'Cup holder', 'Seat fabric', 'Dashboard color'],
      answer: 'Horn and lights',
    },
    {
      id: 'walk-tires',
      prompt: 'Why inspect tires before operation?',
      options: ['They affect stability and steering', 'They change the training score', 'They control the horn', 'They identify the operator'],
      answer: 'They affect stability and steering',
    },
  ],
  'load-handling': [
    {
      id: 'engine-start-key',
      prompt: 'Which key starts the engine in this simulation?',
      options: ['E', 'W', 'S', 'A'],
      answer: 'E',
    },
    {
      id: 'accelerate-key',
      prompt: 'Which key accelerates the forklift forward?',
      options: ['W', 'S', 'A', 'D'],
      answer: 'W',
    },
    {
      id: 'brake-key',
      prompt: 'Which key slows down or stops the forklift?',
      options: ['S', 'W', 'A', 'D'],
      answer: 'S',
    },
  ],
  'post-operation': [
    {
      id: 'post-forks',
      prompt: 'What should be done to the forks after operation?',
      options: ['Lower them completely', 'Leave them raised', 'Remove them', 'Paint them'],
      answer: 'Lower them completely',
    },
    {
      id: 'post-controls',
      prompt: 'Where should controls be placed during shutdown?',
      options: ['Neutral', 'Reverse', 'Lift position', 'Tilt position'],
      answer: 'Neutral',
    },
    {
      id: 'post-report',
      prompt: 'What should be reported after operation?',
      options: ['Unsafe conditions or visible damage', 'Only the weather', 'Only the operator name', 'Nothing ever'],
      answer: 'Unsafe conditions or visible damage',
    },
  ],
  'pallet-testing': [
    {
      id: 'pallet-overload',
      prompt: 'What happens when a forklift lifts more than its rated capacity?',
      options: ['It can tip forward', 'It drives faster', 'Nothing changes', 'The horn sounds'],
      answer: 'It can tip forward',
    },
    {
      id: 'pallet-braking',
      prompt: 'How should you brake while carrying a load?',
      options: ['Gradually and early', 'As hard as possible', 'Only in reverse', 'Never brake'],
      answer: 'Gradually and early',
    },
    {
      id: 'pallet-cones',
      prompt: 'What do traffic cones mark in a work area?',
      options: ['Hazards and travel limits', 'Parking rewards', 'Fuel stations', 'Speed boosts'],
      answer: 'Hazards and travel limits',
    },
  ],
}
