// Playwright snippet for the Playwright MCP's browser_run_code_unsafe tool
// (the MCP runs it with `page` and has no import(), so it is one function
// expression). make-runner.sh copies it with __SCENARIO__ filled in to
// .playwright-mcp/sim-verify-<scenario>.js, which is passed as `filename`.
// Returns a JSON report string.
//
// Runs one named driving-simulation scenario in the real app.
// Signs in, opens the driving step (as the demo trainee on the module page; if
// that step is still locked by the trainee's progress, as the demo admin in
// the Module Editor's 3D preview, which mounts the same
// DrivingSimulationViewer), warps with window.__drivingDebugSet, drives with
// real key presses, and reports window.__drivingDebug plus the HUD text.

async (page) => {
  const SCENARIO = '__SCENARIO__'
  const BASE = 'http://localhost:5173'

  // Each action: { press } taps a key; { hold, until, timeout } holds a key
  // (or several: hold: ['w', 'a']) until the JS expression `until` (over
  // `d` = window.__drivingDebug) is true; { wait } sleeps; { set } calls
  // __drivingDebugSet mid-run.
  // `expect` is a list of JS expressions over `d` that must all be true;
  // they can also read `a`, the audio engine's window.__audioDebug(), `l`,
  // the safety signs' layout over the run ({ maxSigns, overlap }), and `p`,
  // the step's saved attemptStats entry (trainee mode only, else null).
  //
  // Since Phase 6 `d` also carries the safety signs: `d.signs` (the ones
  // shown, [{ id, severity, kind }]) and this attempt's `d.violations` /
  // `d.dangers` ({ ruleId: n }).
  //
  // Since Phase 4 the engine only starts through the pre-start interlock
  // (seatbelt, parking brake, direction N) and the parking brake holds the
  // truck. START is the learner's sequence on real keys: B (seatbelt), Space
  // (parking brake on), E, Space (parking brake off). A scenario can instead
  // set the switches with __drivingDebugSet ({ seatbelt, parkingBrake,
  // direction }), as cone-fail does.
  const START = [{ press: 'b' }, { press: 'Space' }, { press: 'e' }, { press: 'Space' }]

  // Since Phase 7 pallets and cones are physics bodies. A held W cannot creep
  // the forks into a pallet (a learner feathers it, and striking a pallet at
  // speed is a fail), so the pallet scenarios warp the truck to where its
  // lowered forks are already in the pockets, which touches nothing, and
  // use real keys from there. FORKS_IN is that place for each course's
  // pallet: its near face, less the fork heel's 0.308 and a centimetre.
  // A load on the forks goes with a warp.
  const FORKS_IN = { precisionCarry: 4.5395, loadLimitsHeavy: 6.5645, palletPickup: 9.5395, rackStorage: 5.5395 }
  // Up to travel height (the valve coasts the carriage on to about 0.05) and
  // the mast back.
  const PICK_UP = [
    { hold: 'r', until: 'd.forkHeight >= 0.035', timeout: 5000 },
    { hold: 't', until: 'd.tilt <= -0.1', timeout: 5000 },
    { wait: 300 },
  ]
  // Level the mast, lower until the floor has the load and the forks hang
  // free, back straight out.
  const SET_DOWN = [
    { hold: 'g', until: 'd.tilt >= -0.002', timeout: 5000 },
    { hold: 'f', until: 'd.forkHeight <= 0', timeout: 5000 },
    { hold: 's', until: 'd.deliveredCount >= 1 || d.z < 16.5', timeout: 10000 },
  ]
  const SCENARIOS = {
    smoke: {
      module: 'load-handling', step: 'Accelerate Course',
      actions: [...START, { hold: 'w', until: 'd.speed > 0.5', timeout: 8000 }],
      expect: ['d.engineOn', 'd.seatbelt', '!d.parkingBrake', 'd.speed > 0', 'd.z > 0', '!d.failed'],
    },
    accelerate: {
      module: 'load-handling', step: 'Accelerate Course',
      actions: [...START, { hold: 'w', until: 'd.checkpointIndex >= 1', timeout: 25000 }, { hold: 's', until: 'd.speed < 0.06', timeout: 5000 }],
      expect: ['d.checkpointIndex === 1', '!d.failed'],
    },
    brake: {
      module: 'load-handling', step: 'Accelerate and Brake',
      actions: [...START, { hold: 'w', until: 'd.z >= 10.5', timeout: 25000 }, { hold: 's', until: 'd.speed < 0.06', timeout: 5000 }, { wait: 1500 }],
      expect: ['d.checkpointIndex === 1', 'Math.abs(d.speed) < 0.05', '!d.failed'],
    },
    'cone-fail': {
      module: 'post-operation', step: 'Secure Parking',
      // The switches through the debug hook instead of keys.
      setup: { x: 1.2, z: 2.8, heading: 0, seatbelt: true, parkingBrake: true },
      actions: [{ press: 'e' }, { set: { parkingBrake: false } }, { hold: 'w', until: 'd.failed', timeout: 8000 }],
      expect: ["d.failReason === 'cone'"],
    },
    park: {
      module: 'post-operation', step: 'Secure Parking',
      setup: { x: -2.6, z: 15.4, heading: 0 },
      actions: [
        ...START,
        { hold: 'w', until: 'd.z >= 15.7', timeout: 8000 },
        { hold: 's', until: 'd.speed < 0.02', timeout: 5000 },
        { wait: 1200 },
        // Stopped in the bay with the keyboard's lever in N. Key off alone
        // is not parked since Phase 4 (the log shows the engine off and not
        // yet parked); setting the parking brake completes it.
        { press: 'e' },
        { wait: 500 },
        { press: 'Space' },
        { wait: 500 },
      ],
      expect: ['d.parked', "d.parkingStatus === 'driving.parking.done'", 'd.parkingBrake', "d.direction === 'N'", '!d.engineOn'],
    },
    'pallet-pickup': {
      module: 'pallet-testing', step: 'Precision Carry',
      setup: { x: 0, z: FORKS_IN.precisionCarry, heading: 0 },
      actions: [...START, ...PICK_UP],
      expect: ["d.palletStates[0] === 'carried'", 'd.palletOnForks[0]', 'd.palletHeights[0] > 0.02', "d.grip === 'secure'", 'd.carriedIndex === 0', '!d.failed'],
    },
    'pallet-deliver': {
      module: 'pallet-testing', step: 'Precision Carry',
      setup: { x: 0, z: FORKS_IN.precisionCarry, heading: 0 },
      actions: [
        ...START,
        ...PICK_UP,
        // Warp the laden truck to just short of the drop zone's centre; the
        // load goes with the forks.
        { set: { x: 0, z: 18.4, speed: 0 } },
        { wait: 300 },
        ...SET_DOWN,
      ],
      expect: ['d.deliveredCount === 1', "d.palletStates[0] === 'delivered'", 'Math.abs(d.palletHeights[0]) < 0.002', '!d.failed'],
    },
    overload: {
      module: 'pallet-testing', step: 'Load Limits',
      setup: { x: 0, z: FORKS_IN.loadLimitsHeavy, heading: 0 },
      actions: [...START, { hold: 'r', until: 'd.failed', timeout: 5000 }, { wait: 500 }],
      expect: ["d.failReason === 'overload'", 'd.load && d.load.overCapacity'],
    },
    'rack-store': {
      module: 'pallet-testing', step: 'Rack Storage',
      setup: { x: 0, z: FORKS_IN.rackStorage, heading: 0 },
      actions: [
        ...START,
        ...PICK_UP,
        // Warp the laden truck to just short of the rack, raise the load
        // above the middle shelf, then to where the rack's face stops the
        // truck: the load is over the shelf. (Driving up to it with a held
        // W passes the rack-strike speed; a learner feathers it.)
        { set: { x: 0, z: 13.4, speed: 0 } },
        { hold: 'r', until: 'd.forkHeight >= 0.415', timeout: 8000 },
        { wait: 400 },
        { set: { x: 0, z: 14.369, speed: 0 } },
        { wait: 300 },
        { hold: 'g', until: 'd.tilt >= -0.002', timeout: 5000 },
        // Down until the shelf has the load and the tines hang free in it.
        { hold: 'f', until: 'd.forkHeight <= 0.372', timeout: 5000 },
        { hold: 's', until: 'd.deliveredCount >= 1 || d.z < 13.2', timeout: 10000 },
      ],
      expect: ['d.deliveredCount === 1', "d.palletStates[0] === 'delivered'", 'Math.abs(d.palletHeights[0] - 0.3698) < 0.003', '!d.failed'],
    },
    // --- Physics (Phase 7) --------------------------------------------------
    'pallet-impact': {
      module: 'load-handling', step: 'Pallet Pickup & Placement',
      // Forks too high for the pockets, driven at the pallet: the tines meet
      // its face at speed.
      setup: { x: 0, z: 7, heading: 0, forkHeight: 0.05 },
      actions: [...START, { hold: 'w', until: 'd.failed', timeout: 10000 }, { wait: 600 }],
      expect: ["d.failReason === 'pallet-impact'", 'd.palletPositions[0][2] > 10.05', "a.played.includes('palletDrop')"],
    },
    'load-drop': {
      module: 'pallet-testing', step: 'Precision Carry',
      // The forks two thirds of the way in and the mast left upright: full
      // brake from speed slides the load off the tines.
      setup: { x: 0, z: 4.426, heading: 0 },
      actions: [
        ...START,
        { hold: 'r', until: 'd.forkHeight >= 0.035', timeout: 5000 },
        { wait: 300 },
        { hold: 'w', until: 'd.speed >= 1.0 || d.failed', timeout: 10000 },
        { hold: 's', until: 'd.failed || d.speed < 0.02', timeout: 6000 },
        { wait: 1500 },
      ],
      expect: ["d.failReason === 'load-dropped'", "d.dangers['load-shifting'] >= 1", '!d.palletOnForks[0]', '!l.overlap'],
    },
    'tip-over': {
      module: 'load-handling', step: 'Pallet Pickup & Placement',
      // A load carried high through a swerve at speed: the tip-risk sign
      // comes up, then the truck goes over. The fall is the physics engine's:
      // it ends lying on its right side, with a clang as it lands.
      setup: { x: 0, z: FORKS_IN.palletPickup, heading: 0 },
      actions: [
        ...START,
        { hold: 'r', until: 'd.forkHeight >= 0.7', timeout: 10000 },
        { hold: 't', until: 'd.tilt <= -0.1', timeout: 5000 },
        { hold: 'w', until: 'd.speed >= 1.0 || d.failed', timeout: 10000 },
        { hold: ['w', 'a'], until: 'd.failed', timeout: 6000 },
        { wait: 2000 },
      ],
      expect: ["d.failReason === 'tip-over'", "d.tipAxis === 'right'", 'Math.abs(d.tipAngle - Math.PI / 2) < 0.15', "d.dangers['tip-risk'] >= 1", '!d.palletOnForks[0]', "a.played.includes('metalImpact')"],
    },
    interlock: {
      module: 'load-handling', step: 'Accelerate Course',
      actions: [
        // E alone: refused, seatbelt and parking brake missing.
        { press: 'e' },
        { wait: 200 },
        { press: 'b' },
        // Seatbelt on: still refused, parking brake missing.
        { press: 'e' },
        { wait: 200 },
        { press: 'Space' },
        { press: 'e' },
        { wait: 200 },
        // Running with the parking brake set: W does not move the truck, so
        // this hold is expected to time out with z still 0.
        { hold: 'w', until: 'd.z > 0.05', timeout: 1500 },
        { press: 'Space' },
        { hold: 'w', until: 'd.speed > 0.3', timeout: 8000 },
      ],
      expect: ['d.engineOn', 'd.interlockMissing.length === 0', '!d.parkingBrake', 'd.z > 0.1'],
    },
    sound: {
      module: 'load-handling', step: 'Accelerate Course',
      // A refused start (the denial tone), the start sequence (switch clicks
      // and the starter), the horn, then reverse for the beeper. It proves
      // the samples load and the right ones are asked for, not how they
      // sound: that needs ears.
      actions: [{ press: 'e' }, { wait: 300 }, ...START, { wait: 900 }, { press: 'h' }, { hold: 's', until: 'd.speed < -0.2', timeout: 6000 }],
      expect: [
        'd.engineOn',
        "a.state === 'running'",
        "['denied', 'keyClick', 'seatbelt', 'parkingBrake', 'engineStart', 'horn'].every((name) => a.played.includes(name))",
        "['palletDrop', 'coneKnock', 'metalImpact', 'forkScrape'].every((name) => a.loaded.includes(name))",
        'a.loops.length === 7 && a.loops.every((loop) => loop.playing)',
        "a.loops.find((loop) => loop.name === 'reverseBeeper').gain > 0",
        "a.loops.find((loop) => loop.name === 'engineIdle').gain > 0",
      ],
    },
    // --- Safety signs (Phase 6), one per rule family -----------------------
    'sign-interlock': {
      module: 'load-handling', step: 'Accelerate Course',
      actions: [
        // A refused start raises the blue "Fasten the seatbelt" sign.
        { press: 'e' },
        { wait: 400 },
        { press: 'b' },
        { press: 'Space' },
        { press: 'e' },
        { wait: 300 },
        // W against the set parking brake: "Release the parking brake". The
        // truck does not move, so the hold ends on the sign.
        { hold: 'w', until: "d.violations['parking-brake-on'] >= 1", timeout: 3000 },
      ],
      expect: ["d.violations['start-interlock'] === 1", "d.violations['parking-brake-on'] === 1", 'd.engineOn', 'd.z < 0.05', '!l.overlap', 'l.maxSigns >= 1'],
    },
    'sign-obstacle': {
      module: 'post-operation', step: 'Secure Parking',
      // cone-fail's drive: the obstacle sign has to come up, and turn to
      // "stop", before the strike.
      setup: { x: 1.2, z: 2.0, heading: 0, seatbelt: true, parkingBrake: true },
      actions: [{ press: 'e' }, { set: { parkingBrake: false } }, { hold: 'w', until: 'd.failed', timeout: 10000 }],
      expect: ["d.failReason === 'cone'", "d.violations['obstacle-ahead'] === 1", "d.dangers['obstacle-ahead'] === 1", '!l.overlap'],
    },
    'sign-overspeed': {
      module: 'load-handling', step: 'Left and Right Turning',
      // Full throttle on a course with the default 8 km/h limit.
      actions: [
        ...START,
        { hold: 'w', until: 'd.violations.overspeed >= 1', timeout: 8000 },
        { hold: 's', until: 'd.speed < 0.06', timeout: 5000 },
        { wait: 900 },
      ],
      expect: ['d.violations.overspeed === 1', "!d.signs.some((sign) => sign.id === 'overspeed')", '!d.failed', '!l.overlap', 'l.maxSigns >= 1'],
    },
    'sign-load': {
      module: 'pallet-testing', step: 'Precision Carry',
      setup: { x: 0, z: FORKS_IN.precisionCarry, heading: 0 },
      // Pick the pallet up and drive off with the forks high and the mast
      // upright: "Lower the forks for travel" and "Tilt the mast back". The
      // truck is stopped again before it is fast enough for the highTravel
      // fail.
      actions: [
        ...START,
        { hold: 'r', until: 'd.forkHeight >= 0.15', timeout: 5000 },
        { hold: 'w', until: "(d.violations['mast-not-back'] >= 1 && d.violations['forks-high-travel'] >= 1) || d.speed > 0.3", timeout: 5000 },
        { hold: 's', until: 'd.speed < 0.06', timeout: 5000 },
      ],
      expect: ["d.violations['forks-high-travel'] >= 1", "d.violations['mast-not-back'] >= 1", 'l.maxSigns === 2', '!l.overlap', '!d.failed'],
    },
    'sign-overload': {
      module: 'pallet-testing', step: 'Load Limits',
      setup: { x: 0, z: FORKS_IN.loadLimitsHeavy, heading: 0 },
      // Forks in the 1,500 kg pallet: "Do not lift", before anything is
      // lifted.
      actions: [...START, { wait: 600 }],
      expect: ["d.signs.some((sign) => sign.id === 'overload' && sign.severity === 'danger')", 'd.dangers.overload === 1', '!d.failed', '!l.overlap'],
    },
    'sign-reverse': {
      module: 'load-handling', step: 'Accelerate Course',
      // Reversing in first-person while looking ahead, then looking behind
      // (arrow down) clears the sign.
      actions: [
        ...START,
        { hold: 's', until: "d.violations['look-direction'] >= 1", timeout: 6000 },
        { press: 'ArrowDown' },
        { hold: 's', until: "!d.signs.some((sign) => sign.id === 'look-direction')", timeout: 4000 },
      ],
      expect: ["d.violations['look-direction'] === 1", "!d.signs.some((sign) => sign.id === 'look-direction')", '!l.overlap'],
    },
    'sign-release': {
      module: 'pallet-testing', step: 'Precision Carry',
      setup: { x: 0, z: FORKS_IN.precisionCarry, heading: 0 },
      // A load lowered into the drop zone with the mast still tilted back:
      // the fork tips stay caught under it, and the hint to tilt the mast
      // forward comes up. It is not counted, and clears once the mast is
      // level and the load is off the forks.
      actions: [
        ...START,
        ...PICK_UP,
        { set: { x: 0, z: 18.4, speed: 0 } },
        { wait: 300 },
        { hold: 'f', until: "d.signs.some((sign) => sign.id === 'release-load')", timeout: 6000 },
        { hold: 'g', until: 'd.tilt >= -0.002', timeout: 5000 },
        { hold: 'f', until: 'd.forkHeight <= 0', timeout: 5000 },
        { wait: 1000 },
      ],
      expect: ["d.palletStates[0] === 'released'", "!d.signs.some((sign) => sign.id === 'release-load')", "d.violations['release-load'] === undefined", 'l.maxSigns >= 1', '!l.overlap', '!d.failed'],
    },
    'sign-record': {
      module: 'load-handling', step: 'Accelerate Course',
      // Completing a step saves what the signs logged with the learner's
      // progress, and the task panel sums it up. Trainee mode only.
      actions: [...START, { hold: 'w', until: 'd.checkpointIndex >= 1', timeout: 25000 }, { hold: 's', until: 'd.speed < 0.06', timeout: 5000 }, { wait: 800 }],
      expect: ['d.checkpointIndex === 1', 'p && typeof p.completedAt === "string"', 'p && p.bestViolations <= Object.values(p.violations).reduce((sum, n) => sum + n, 0)', 'l.summary !== null'],
    },
  }

  const scenario = SCENARIOS[SCENARIO]
  if (!scenario) return JSON.stringify({ error: `Unknown scenario "${SCENARIO}"`, scenarios: Object.keys(SCENARIOS) })

  // Chrome throttles a window that other windows cover (Blender, an editor)
  // to a frame or two a second, and the fixed-step sim then crawls: holds
  // time out with the truck barely moved. Keep the tab in front.
  await page.bringToFront()

  // A steering wheel plugged into this machine is live in the browser too, and
  // a limp wheel resting a few degrees off centre steers the truck (as it
  // should). The keyboard scenarios hide gamepads so they drive the same on
  // any machine; the flag is read by an init script on every page load.
  if (!page.__simVerifyGamepadStub) {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('sim-verify-hide-gamepads') === '1') navigator.getGamepads = () => []
    })
    page.__simVerifyGamepadStub = true
  }
  await page.goto(`${BASE}/login`)
  await page.evaluate((hide) => sessionStorage.setItem('sim-verify-hide-gamepads', hide ? '1' : '0'), !scenario.gamepads)

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300))
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 300)))

  // The login endpoint allows 10 attempts per 15 minutes (authLimiter in
  // backend/src/lib/rateLimit.js), so a session already held for this account
  // is reused rather than signing in again for every scenario.
  const signIn = async (email, password) => {
    await page.goto(`${BASE}/login`)
    const result = await page.evaluate(async ([email, password]) => {
      const token = localStorage.getItem('gearview_token')
      const cached = JSON.parse(localStorage.getItem('gearview_user') || 'null')
      if (token && cached?.email === email) {
        const check = await fetch('/api/progress', { headers: { Authorization: `Bearer ${token}` } })
        if (check.ok) return { ok: true, reused: true }
      }
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) return { ok: false, status: response.status }
      const body = await response.json()
      localStorage.setItem('gearview_token', body.token)
      localStorage.setItem('gearview_user', JSON.stringify(body.user))
      return { ok: true }
    }, [email, password])
    if (result.status === 429) throw new Error(`Sign-in as ${email} was rate limited (HTTP 429): too many logins in 15 minutes. Restart the backend to clear it, or wait.`)
    if (!result.ok) throw new Error(`Sign-in as ${email} failed (HTTP ${result.status}). Is the backend running and seeded?`)
  }

  const waitForSim = () => page.waitForFunction(() => window.__drivingDebug && window.__drivingDebugSet, null, { timeout: 30000 })
  const stepPattern = new RegExp(scenario.step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  // Learner route first.
  let mode = 'trainee'
  await signIn('trainee@mail.com', 'trainee123')
  await page.goto(`${BASE}/training/modules/${scenario.module}`)
  const scope = page.getByRole('button', { name: 'Continue' })
  if (await scope.isVisible({ timeout: 5000 }).catch(() => false)) await scope.click()
  const stepItem = page.locator('li[role="button"]').filter({ hasText: stepPattern }).first()
  await stepItem.waitFor({ timeout: 15000 })
  const locked = (await stepItem.getAttribute('aria-disabled')) === 'true'

  if (!locked) {
    await stepItem.click()
    await waitForSim()
  } else {
    // The trainee has not reached this step yet: use the admin preview.
    mode = 'admin-preview'
    await signIn('admin@mail.com', 'admin123')
    await page.goto(`${BASE}/admin/modules/${scenario.module}`)
    await page.getByText(stepPattern).first().click()
    await page.getByRole('button', { name: 'Show 3D preview' }).click()
    await waitForSim()
    // Keep key presses out of the editor's form fields.
    await page.locator('canvas').first().click({ position: { x: 5, y: 5 } })
  }
  await page.waitForTimeout(500)

  const debug = () => page.evaluate(() => ({ ...window.__drivingDebug }))
  const setState = (patch) => page.evaluate((patch) => window.__drivingDebugSet(patch), patch)

  if (scenario.setup) {
    await setState(scenario.setup)
    await page.waitForTimeout(100)
  }

  // Where the safety signs sit against the dashboard and the proximity inset,
  // sampled through the run: they must never cover either.
  const layout = { maxSigns: 0, overlap: false, summary: null }
  const sampleLayout = async () => {
    const sample = await page.evaluate(() => {
      const box = (element) => element.getBoundingClientRect()
      const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const signs = [...document.querySelectorAll('.safety-sign')].map(box)
      const blocked = [...document.querySelectorAll('.operator-dashboard, .proximity-inset')].map(box)
      return {
        signs: signs.length,
        overlap: signs.some((sign) => blocked.some((other) => overlaps(sign, other))),
        summary: document.querySelector('[data-attempt-violations]')?.textContent ?? null,
      }
    })
    layout.maxSigns = Math.max(layout.maxSigns, sample.signs)
    layout.overlap = layout.overlap || sample.overlap
    layout.summary = sample.summary
  }

  const log = []
  for (const action of scenario.actions) {
    if (action.press) {
      await page.keyboard.press(action.press)
      await page.waitForTimeout(150)
    } else if (action.wait) {
      await page.waitForTimeout(action.wait)
    } else if (action.set) {
      await setState(action.set)
    } else if (action.hold) {
      const keys = [].concat(action.hold)
      for (const key of keys) await page.keyboard.down(key)
      let reached = true
      // Signs come and go inside a hold; watch them while it runs.
      const watching = setInterval(() => sampleLayout().catch(() => {}), 100)
      try {
        await page.waitForFunction(
          (expression) => {
            const d = window.__drivingDebug
            return d && new Function('d', `return (${expression})`)(d)
          },
          action.until,
          { timeout: action.timeout ?? 10000, polling: 16 },
        )
      } catch {
        reached = false
      }
      clearInterval(watching)
      for (const key of keys) await page.keyboard.up(key)
      if (!reached) log.push(`timed out holding ${keys.join('+').toUpperCase()} until ${action.until}`)
    }
    await sampleLayout()
    const d = await debug()
    log.push(`${JSON.stringify(action)} -> t=${d.time?.toFixed(2)} x=${d.x.toFixed(3)} z=${d.z.toFixed(3)} v=${d.speed.toFixed(3)} fork=${d.forkHeight.toFixed(3)} tilt=${d.tilt.toFixed(3)}${d.failed ? ` FAILED(${d.failReason})` : ''}${d.signs?.length ? ` signs=${d.signs.map((sign) => sign.id).join('+')}` : ''}`)
  }

  await page.waitForTimeout(300)
  const final = await debug()
  const audio = await page.evaluate(() => window.__audioDebug?.() ?? null)
  await sampleLayout()
  // The step's saved safety record. The admin preview saves no progress.
  const record = mode === 'trainee'
    ? await page.evaluate(([module, stepTitle]) => {
        const stats = JSON.parse(localStorage.getItem('gearview_progress_v1') || '{}').simulations?.[module]?.attemptStats || {}
        const stepId = stepTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        return stats[stepId] ?? null
      }, [scenario.module, scenario.step])
    : null
  const checks = scenario.expect.map((expression) => {
    let passed = false
    try {
      passed = Boolean(new Function('d', 'a', 'l', 'p', `return (${expression})`)(final, audio, layout, record))
    } catch {
      // An expression over `a` with no audio engine on the page.
    }
    return { expression, passed }
  })
  const hud = await page.locator('.driving-hud-status').first().innerText().catch(() => null)

  return JSON.stringify(
    {
      scenario: SCENARIO,
      mode,
      passed: checks.every((check) => check.passed),
      checks,
      log,
      hud: hud?.split('\n'),
      debug: final,
      layout,
      record,
      audio,
      consoleErrors,
    },
  )
}
