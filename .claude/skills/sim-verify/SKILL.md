---
name: sim-verify
description: Drive the GearView3D forklift driving simulation in the real browser app and report what it did. Starts the dev servers if needed, signs in as the demo trainee (or the admin's Module Editor preview when the step is still locked), opens a driving step, runs a named scenario (accelerate, brake, park, cone-fail, pallet-pickup, pallet-deliver, overload, rack-store, pallet-impact, load-drop, tip-over, smoke, interlock, cab-switches, sound, or a sign-* safety-sign scenario) through window.__drivingDebugSet plus real key presses, and reports window.__drivingDebug, the HUD and console errors. Use this whenever a change touches the driving sim (lib/driving/*, lib/physics/*, DrivingSimulationViewer, controls, telemetry, the safety rules and signs, the vehicle profile, courses), to re-verify built-in courses after a post-defense phase, or whenever someone asks to check, smoke-test or confirm the driving/forklift simulation still works in the browser, even if they don't name the skill.
---

# sim-verify

Checks the driving simulation end to end in the running app. The headless
tests (`npm test` in `frontend/`, especially
`src/lib/driving/simCore.characterization.test.js`) prove the sim logic; this
skill proves the wiring around it: the viewer, keyboard input, the fixed-step
loop in `useFrame`, the physics engine loading in the browser, `syncView`, the
HUD telemetry and the debug hooks. Run both after a sim change. The headless
counterparts of the physics scenarios are in
`src/lib/driving/physicsScenarios.test.js`.

## 1. Servers

Run `bash .claude/skills/sim-verify/scripts/check-servers.sh` from the repo root.
If either server is down, start it in the background (it never exits on its own)
and re-check after a few seconds:

- backend: `cd backend && npm run dev` (needs `backend/.env` and a seeded DB, see CLAUDE.md)
- frontend: `cd frontend && npm run dev`

The debug hooks only exist in the Vite dev build (`import.meta.env.DEV`), so a
production build or the live instance can't be used.

## 2. Run a scenario

From the repo root, run
`bash .claude/skills/sim-verify/scripts/make-runner.sh <scenario>`. It writes
`.playwright-mcp/sim-verify-<scenario>.js`, which is `scripts/run-scenario.js`
with the scenario name filled in, into a gitignored folder the Playwright MCP
may read. Pass that path as `filename` to the Playwright MCP tool
`browser_run_code_unsafe`; load it with ToolSearch
`select:mcp__playwright__browser_run_code_unsafe` if needed. The MCP has no
`import()`, which is why the runner is one self-contained function rather than
a module. The call returns a JSON report. The tool echoes the runner's source
after the result; ignore that part.

Scenarios don't depend on each other, so run whichever ones the change
touches, one after another. The runner reuses the browser's session for the
account it needs, because the login endpoint allows only 10 sign-ins per 15
minutes. If you still get a 429, restart the backend: touching any file under
`backend/src` makes `node --watch` restart it, which clears the in-memory
limiter.

| Scenario | Step | What passing proves |
|---|---|---|
| `smoke` | Load Handling, Accelerate Course | scene mounts, the start sequence starts the engine, W drives |
| `accelerate` | Load Handling, Accelerate Course | finish line checkpoint fires |
| `brake` | Load Handling, Accelerate and Brake | S brakes to a stop inside the stop zone |
| `cone-fail` | Post-Operation, Secure Parking | cone collision fails the attempt |
| `park` | Post-Operation, Secure Parking | bay + stop + N + engine off + parking brake latches parked |
| `pallet-pickup` | Pallet Testing, Precision Carry | the forks lift the pallet off the floor: carried, on the forks, secure grip, mast back |
| `pallet-deliver` | Pallet Testing, Precision Carry | level the mast, lower, back out: the pallet rests on the floor of the drop zone, delivered |
| `overload` | Pallet Testing, Load Limits | lifting the 1,500 kg pallet fails as an overload |
| `rack-store` | Pallet Testing, Rack Storage | a load lowered onto the middle shelf rests at shelf height and is delivered once the forks are out |
| `pallet-impact` | Load Handling, Pallet Pickup & Placement | forks too high for the pockets, driven at the pallet: fails as a pallet impact, and the pallet is shoved |
| `load-drop` | Pallet Testing, Precision Carry | forks two thirds in, full brake from speed: the load slides off, the load-shifting sign comes up, the attempt fails as a lost load |
| `tip-over` | Load Handling, Pallet Pickup & Placement | a load carried high through a swerve: tip-risk sign, then the truck goes over; the fall is simulated, and it ends lying on its right side (`tipAngle` about pi/2) with the load thrown clear and the metal impact played |
| `interlock` | Load Handling, Accelerate Course | E is refused without seatbelt and parking brake; the parking brake holds the truck against W |
| `cab-switches` | Load Handling, Accelerate Course | L, O, [ and ] work the lights, the beacon and the turn signals (`__drivingDebug` reports `lights`, `beacon`, `turnSignal`) |
| `sound` | Load Handling, Accelerate Course | the samples load, the six loops run, and the denial tone, switch clicks, starter, horn and reverse beeper are asked for |
| `sign-interlock` | Load Handling, Accelerate Course | a refused start raises the start-interlock sign; W against the parking brake raises parking-brake-on |
| `sign-obstacle` | Post-Operation, Secure Parking | driving at a cone raises obstacle-ahead and steps it up to danger before the strike |
| `sign-overspeed` | Load Handling, Left and Right Turning | full throttle passes the default 8 km/h limit; the sign clears after stopping |
| `sign-load` | Pallet Testing, Precision Carry | driving off with the forks high and the mast upright raises forks-high-travel and mast-not-back, two signs stacked |
| `sign-overload` | Pallet Testing, Load Limits | forks in the 1,500 kg pallet raise the overload danger sign before anything is lifted |
| `sign-reverse` | Load Handling, Accelerate Course | reversing in first-person raises look-direction; looking behind (arrow down) clears it |
| `sign-release` | Pallet Testing, Precision Carry | a load lowered into the drop zone with the mast still back raises the release-load hint, which is not counted and clears once the mast is level and the load is set down |
| `sign-record` | Load Handling, Accelerate Course | completing the step saves attemptStats with the learner's progress and shows the summary (trainee mode only) |

Since Phase 4 the engine only starts through the pre-start interlock
(seatbelt, parking brake, direction lever in N), and the parking brake holds
the truck. Scenarios start with `START`, the learner's sequence on real keys
(B, Space, E, Space). `__drivingDebugSet` also takes `seatbelt`,
`parkingBrake` and `direction` ('F' | 'N' | 'R', or 'auto' to hand direction
back to the keyboard), and `__drivingDebug` reports `direction`, `seatbelt`,
`parkingBrake` and `interlockMissing`.

A steering wheel plugged into the machine is live in the Playwright browser
too, and a wheel resting a few degrees off centre steers the truck. The runner
hides gamepads (an init script stubs `navigator.getGamepads`) unless a
scenario sets `gamepads: true`, so the keyboard scenarios drive the same on
any machine. For a hardware check, have the user drive in the same window
and read `__drivingDebug` back.

Since Phase 7 pallets and cones are physics bodies (Rapier), and the pallet
scenarios changed with them. A held W cannot creep the forks into a pallet,
and striking one at speed is a fail, so they warp the truck to where its
lowered forks are already in the pockets (`FORKS_IN` in the script: the
pallet's near face, less 0.3105) and use real keys from there. A load on the
forks goes with a warp. `__drivingDebug` gained `palletPositions`,
`palletOnForks`, `palletSlipSpeeds`, `conesHit`, `load` (`{ kg, centre,
deratedKg, overCapacity }`, the capacity plate's reading), `stability`
(`{ longitudinal, lateral }` margins), `limits` (what the forks are up
against) and `tipAxis`; `palletRisks` and `palletInsertDepths` are gone. A
hold can take several keys (`hold: ['w', 'a']`). The `sound` scenario expects
seven loops (the fork scrape was added).

Scenarios warp the truck with `__drivingDebugSet` to skip the long drives and
then use real key presses for the part being checked. So they exercise the
keyboard source, the telemetry-backed HUD and events, not just state writes. To
add one, add an entry to `SCENARIOS` in the script: actions are
`{ press }`, `{ hold, until, timeout }`, `{ wait }` and `{ set }`, and `expect`
is a list of JS expressions over `d` (the `__drivingDebug` snapshot, whose
fields are listed in `core.debugSnapshot()` in
`frontend/src/lib/driving/simCore.js`). Timing in the browser varies from frame
to frame, so hold keys *until* a condition rather than for a fixed time. Don't
approach a rack with a held W: it passes the rack-strike speed (0.3 units/s)
quickly, so warp to the rack face instead (z 14.369 for the stock rack at
z 15), with the load already raised above the shelf.

Since Phase 6 `__drivingDebug` also carries the safety signs
(`lib/driving/safetyMonitor.js`): `signs` (the ones shown, `[{ id, severity,
kind }]`) and this attempt's `violations` and `dangers` (`{ ruleId: n }`). A
sign needs its rule to hold for 150 ms and stays 500 ms after it stops, so
hold a key *until* `d.violations[...]` rather than checking `d.signs` at one
instant. Expressions can also read `l`, the signs' layout sampled through the
run (`maxSigns`, `overlap` with the dashboard or the proximity inset, which
must stay false, and the task panel's `summary` text), and `p`, the step's
saved `attemptStats` entry from the learner's progress (null in the admin
preview, which saves none). The report includes them as `layout` and
`record`. The `sign-*` scenarios cover one rule family each; the rest of the
rules (tail swing, turn speed, obstacle behind, seatbelt, forks raised when
parked, lifting on the move, tilting a raised load forward, shuttling the
lever) fire in the headless drives of
`frontend/src/lib/driving/safetyMonitor.test.js`. The stock 8 km/h speed
limit means a held W raises the overspeed sign on most courses; that is
expected, not a failure.

Expressions can also read `a`, the audio engine's `window.__audioDebug()`
(`debugSnapshot()` in `frontend/src/lib/audio/audioEngine.js`): `state`, the
`loaded` sample names, the open `loops` with the `gain` and `rate` each is
heading for, and the one-shots `played`. The report includes it as `audio`.
That shows which sounds were asked for. Whether they click, gap or are too
loud is for the user to judge by ear.

## 3. Report

For each scenario give: pass/fail, the mode (`trainee` or `admin-preview`), any
failed `expect` expression with the final values it read, timeouts from the
log, and console errors. Leave out three.js deprecation warnings; they are
warnings, and the runner only collects errors. Keep it short. The user wants
to know whether the sim works and, if not, where it went wrong.

A known, harmless console error: `Free-goal course "controls-intro" has no
completionCode` comes from a seeded DB row that predates `completionCode`, not
from the sim.

If a scenario fails, check whether the course data changed before blaming the
code. The expectations assume the stock courses in
`frontend/src/data/drivingCourse.js`, and an admin can edit the DB copies. Read
the step's course with `GET /api/content/courses/<module-slug>` (signed in) or in the
Module Editor.
