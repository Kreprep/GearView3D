#!/usr/bin/env bash
# Reports whether the GearView3D dev servers are up. Exit 0 when both are.
# Starting them is left to the caller (long-running, so run each in the
# background):
#   (cd backend && npm run dev)     # API on :4000
#   (cd frontend && npm run dev)    # Vite on :5173, proxies /api to :4000
api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/content/equipment)
vite=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)
# The equipment endpoint needs a token, so 401 means the API is alive.
api_ok=false; [ "$api" = "200" ] || [ "$api" = "401" ] && api_ok=true
vite_ok=false; [ "$vite" = "200" ] && vite_ok=true
echo "backend :4000 -> HTTP $api ($([ "$api_ok" = true ] && echo up || echo down))"
echo "frontend :5173 -> HTTP $vite ($([ "$vite_ok" = true ] && echo up || echo down))"
[ "$api_ok" = true ] && [ "$vite_ok" = true ]
