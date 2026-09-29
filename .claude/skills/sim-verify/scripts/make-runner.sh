#!/usr/bin/env bash
# Usage: bash .claude/skills/sim-verify/scripts/make-runner.sh <scenario>
# Run from the repo root. Writes .playwright-mcp/sim-verify-<scenario>.js (a
# gitignored folder the Playwright MCP is allowed to read) and prints its path
# for browser_run_code_unsafe's `filename`.
set -e
scenario="${1:?scenario name required}"
here="$(dirname "$0")"
mkdir -p .playwright-mcp
out=".playwright-mcp/sim-verify-${scenario}.js"
sed "s/__SCENARIO__/${scenario}/" "$here/run-scenario.js" > "$out"
echo "$out"
