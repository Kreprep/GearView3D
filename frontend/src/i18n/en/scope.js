// The "preparatory learning only" disclaimer. Deliberately not admin-editable:
// it is the scope statement, not content.
export default {
  'scope.title': 'Preparatory learning only',
  // One key, not three nodes. The body interleaves two fixed sentences around
  // the per-equipment {note}, and the two languages do not order them the same
  // way - so it cannot be split without one of them reading wrong.
  'scope.body': "GearView3D is a familiarization tool and not a certification simulator. {note} Always refer to the manufacturer's operator manual and your site's equipment-specific procedures before operating actual equipment.",
  'scope.dismiss': 'Continue',

  // One entry per equipment that needs its own sentence. Anything without one
  // gets the neutral default - a backhoe learner never reads about forklift
  // classes.
  'scope.note.default': 'The 3D model shown is one representative make and model - actual equipment may differ in layout, controls, and inspection points.',
  'scope.note.forklift': 'This module models a Class V (internal-combustion, pneumatic-tire) forklift. Other classes, makes, and models may differ in layout, controls, and inspection points.',
}
