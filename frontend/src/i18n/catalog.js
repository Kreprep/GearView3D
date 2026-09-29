// One flat table per language, merged from the namespace files.
//
// Keys are flat and dotted (`hub.state.loadingModules`), and each namespace file
// writes the prefix out in full rather than having it added here - so grepping a
// key finds both the call site and the string. Lookup is then one property read,
// which matters on the per-frame paths t() is called from, and parity between
// languages is a comparison of two sorted key arrays.
//
// One namespace per surface. Add a file to both `en/` and `fil/` and list it
// in both spreads below; catalog.test.js then enforces that the two sides
// declare exactly the same keys with exactly the same {tokens}.
import commonEn from './en/common.js'
import headerEn from './en/header.js'
import loginEn from './en/login.js'
import hubEn from './en/hub.js'
import moduleListEn from './en/moduleList.js'
import hubDefaultsEn from './en/hubDefaults.js'
import moduleEn from './en/module.js'
import walkAroundEn from './en/walkAround.js'
import drivingEn from './en/driving.js'
import scopeEn from './en/scope.js'
import partsEn from './en/parts.js'
import assessmentEn from './en/assessment.js'
import quizEn from './en/quiz.js'

import commonFil from './fil/common.js'
import headerFil from './fil/header.js'
import loginFil from './fil/login.js'
import hubFil from './fil/hub.js'
import moduleListFil from './fil/moduleList.js'
import hubDefaultsFil from './fil/hubDefaults.js'
import moduleFil from './fil/module.js'
import walkAroundFil from './fil/walkAround.js'
import drivingFil from './fil/driving.js'
import scopeFil from './fil/scope.js'
import partsFil from './fil/parts.js'
import assessmentFil from './fil/assessment.js'
import quizFil from './fil/quiz.js'

export const catalog = {
  en: {
    ...commonEn,
    ...headerEn,
    ...loginEn,
    ...hubEn,
    ...moduleListEn,
    ...hubDefaultsEn,
    ...moduleEn,
    ...walkAroundEn,
    ...drivingEn,
    ...scopeEn,
    ...partsEn,
    ...assessmentEn,
    ...quizEn,
  },
  fil: {
    ...commonFil,
    ...headerFil,
    ...loginFil,
    ...hubFil,
    ...moduleListFil,
    ...hubDefaultsFil,
    ...moduleFil,
    ...walkAroundFil,
    ...drivingFil,
    ...scopeFil,
    ...partsFil,
    ...assessmentFil,
    ...quizFil,
  },
}
