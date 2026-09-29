---
name: sim-verify
description: Drive the GearView3D forklift driving simulation in the real browser app and report what it did. Starts the dev servers if needed, signs in as the demo trainee (or the admin's Module Editor preview when the step is still locked), opens a driving step, runs a named scenario (accelerate, brake, park, cone-fail, pallet-pickup, pallet-deliver, overload, rack-store, smoke) through window.__drivingDebugSet plus real key presses, and reports window.__drivingDebug, the HUD and console errors. Use this whenever a change touches the driving sim (lib/driving/*, DrivingSimulationViewer, controls, telemetry, the vehicle profile, courses), to re-verify built-in courses after a post-defense phase, or whenever someone asks to check, smoke-test or confirm the driving/forklift simulation still works in the browser, even if they don't name the skill.
---

# sim-verify

Checks the driving simulation end to end in the running app. The headless
tests (`npm test` in `frontend/`, especially
`src/lib/driving/simCore.characterization.test.js`) prove the sim logic; this
skill proves the wiring around it: the viewer, keyboard input, the fixed-step
loop in `useFrame`, `syncView`, the HUD telemetry and the debug hooks. Run both
after a sim change.

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
| `smoke` | Load Handling, Accelerate Course | scene mounts, E starts the engine, W drives |
| `accelerate` | Load Handling, Accelerate Course | finish line checkpoint fires |
| `brake` | Load Handling, Accelerate and Brake | S brakes to a stop inside the stop zone |
| `cone-fail` | Post-Operation, Secure Parking | cone collision fails the attempt |
| `park` | Post-Operation, Secure Parking | bay + stop + engine off latches parked |
| `pallet-pickup` | Pallet Testing, Precision Carry | forks enter, lift, secure grip, tilt back |
| `pallet-deliver` | Pallet Testing, Precision Carry | lower, tilt forward, back away: delivered |
| `overload` | Pallet Testing, Load Limits | lifting the 1,500 kg pallet fails and tips |
| `rack-store` | Pallet Testing, Rack Storage | load set on the middle shelf is delivered |

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
within a few centimetres, so warp to the rack face instead.

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
