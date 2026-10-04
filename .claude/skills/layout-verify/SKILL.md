---
name: layout-verify
description: Check that every GearView3D module page fits the screen at the decided target (1920x929 and 1920x945, Chrome at 1080p and 100%), in English and Filipino, as the trainee or the admin. Visits every step of every module plus Parts Identification in the real app and fails on page scroll, regions outside the viewport or overlapping (top bar, stepper, task column, driving HUD, dashboard, signs, inset), clipped text, scrollbars other than the task body's, controls under 24x24 px, and a driving HUD toolbar that wraps. Saves a screenshot per step. Use whenever a change touches the module page shell (SimulationPageLayout, ModuleStepper, ModuleSimulationShell), the driving HUD or dashboard, a step's task panel, or i18n strings shown there, or when someone asks whether the module pages still fit, even if they don't name the skill.
---

# layout-verify

The fit rules of `docs/modules/module-improvements-plan.md` section 8, run in
the real app. `sim-verify` checks that the simulation works; this checks that
the page around it fits.

## 1. Servers

Same as sim-verify: `bash .claude/skills/sim-verify/scripts/check-servers.sh`
from the repo root, and start whichever is down (`cd backend && npm run dev`,
`cd frontend && npm run dev`) in the background.

## 2. Run

From the repo root:

```
bash .claude/skills/layout-verify/scripts/make-runner.sh <name> '<options JSON>'
```

writes `.playwright-mcp/layout-verify-<name>.js`. Pass that path as
`filename` to the Playwright MCP tool `browser_run_code_unsafe` (load it with
ToolSearch `select:mcp__playwright__browser_run_code_unsafe` if needed). The
call returns a JSON report; the tool echoes the runner's source after it,
which you can ignore.

Options (all optional):

| Option | Default | Meaning |
|---|---|---|
| `role` | `'trainee'` | `'trainee'` or `'admin'` (the admin sees Free camera and Colliders in the driving HUD's More menu) |
| `modules` | every module | module slugs to visit |
| `heights` | `[929, 945]` | viewport heights; the width is 1920 |
| `languages` | `['en', 'fil']` | |
| `parts` | `true` | also visit Parts Identification |

A full pass is several hundred page states with a WebGL scene on most of them,
so run it in slices, for example one runner per height:
`'{"heights":[929]}'` and `'{"heights":[945]}'`, then `'{"role":"admin","heights":[929],"parts":false}'`.

What the runner does:

- **Every step, locked or not.** It writes a progress copy into localStorage
  that marks every step complete, so the stepper opens all of them, and
  answers `PUT /api/progress` in the browser, so that copy never reaches the
  database. It puts the account's own copy and language back at the end.
  Nothing is written to the DB.
- **CSS pixels.** The MCP's Chrome may run at a 110% device scale, which makes
  a 1920 px window 1745 CSS px wide. The runner scales the window so the page
  sees exactly 1920 x the height, and fails a step whose viewport is anything
  else.
- **On each step** (and with the driving HUD's More menu open, and once per
  module with the task column folded) it checks: no page scroll; the named
  regions inside the viewport and the listed pairs not overlapping; the HUD's
  actions on one row; no clipped text (ellipsis truncation, which the stepper's
  current title and the page title use on purpose, is listed under
  `truncatedByDesign` instead); no scrollbar except `.simulation-task-body`;
  no control under 24x24 px. It records the scene's height (the plan wants at
  least 860 at 929).
- Screenshots go to `.playwright-mcp/layout/<role>-<height>-<lang>-<module>-<nn>-<step>.png`.

## 3. Report

Give, per runner: pass/fail, how many states were visited, the smallest scene
height, and each failing step with its problems. Look over a few screenshots
yourself (a driving step, a walk-around step, the briefing, the collapsed
column, Filipino) before saying it passes: the checks catch boxes, not
ugliness. Mention anything listed under `truncatedByDesign` whose cut-off text
a learner would miss.

Firefox is not covered (the MCP runs Chromium); the plan's Firefox pass is by
hand.
