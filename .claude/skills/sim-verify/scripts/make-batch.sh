#!/usr/bin/env bash
# Usage: bash .claude/skills/sim-verify/scripts/make-batch.sh
# Run from the repo root. Writes .playwright-mcp/sim-verify-batch.js: every scenario
# in run-scenario.js, run one after another in a single browser_run_code_unsafe
# call (the MCP echoes the whole runner on every call, so one call is cheaper).
# Returns a compact JSON list: pass/fail, failed expectations, timeouts, errors.
set -e
src="$(dirname "$0")/run-scenario.js"
out=.playwright-mcp/sim-verify-batch.js
names=$(grep -oE "^    '?[a-z-]+'?: \{$" "$src" | sed -E "s/^ +'?([a-z-]+)'?: \{$/\"\1\"/" | paste -sd, -)
{
  echo 'async (page) => {'
  echo '  const one = ('
  sed -n '/^async (page) => {/,$p' "$src" | sed "1s/.*/async (page, SCENARIO) => {/" | grep -v "const SCENARIO = '__SCENARIO__'"
  echo '  )'
  echo '  const results = []'
  echo "  for (const name of [$names]) {"
  cat <<'JS'
    try {
      const r = JSON.parse(await one(page, name))
      results.push({ s: name, mode: r.mode, passed: r.passed, failed: (r.checks || []).filter((c) => !c.passed).map((c) => c.expression), timeouts: (r.log || []).filter((l) => String(l).startsWith('timed')), errors: r.consoleErrors, error: r.error })
    } catch (error) {
      results.push({ s: name, error: String(error).slice(0, 300) })
    }
  }
  return JSON.stringify(results)
}
JS
} > "$out"
echo "$out: $names"
