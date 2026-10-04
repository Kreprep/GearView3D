#!/usr/bin/env bash
# Usage: bash .claude/skills/layout-verify/scripts/make-runner.sh <name> '<options JSON>'
# Run from the repo root. Writes .playwright-mcp/layout-verify-<name>.js (a
# gitignored folder the Playwright MCP is allowed to read) with the options
# filled in, and prints its path for browser_run_code_unsafe's `filename`.
# Options: { role: 'trainee' | 'admin', modules: [slugs] (default all),
#   heights: [929, 945], languages: ['en', 'fil'], parts: true, width: 1920 }
set -e
name="${1:?runner name required}"
options="${2:-{\}}"
here="$(dirname "$0")"
mkdir -p .playwright-mcp/layout
out=".playwright-mcp/layout-verify-${name}.js"
node -e '
const fs = require("fs")
const [source, options, out] = process.argv.slice(1)
JSON.parse(options)
fs.writeFileSync(out, fs.readFileSync(source, "utf8").replace("const OPTIONS = __OPTIONS__", "const OPTIONS = " + options))
' "$here/run-layout.js" "$options" "$out"
echo "$out"
