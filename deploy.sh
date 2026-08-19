#!/bin/sh
# Pulls the latest main, rebuilds/redeploys the compose stack, waits for the
# API to answer, then prunes what the rebuild orphaned. Run on the LXC itself,
# from the deploy checkout (/docker/gearview3d):
#   ./deploy.sh
set -e

cd "$(dirname "$0")"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty - refusing to pull over local changes. Check 'git status' first." >&2
  exit 1
fi

echo "== Pulling main =="
git pull --ff-only origin main

echo "== Rebuilding and redeploying =="
docker compose up -d --build

echo "== Waiting for the API to come up =="
web_port="$WEB_PORT"
if [ -z "$web_port" ] && [ -f .env ]; then
  web_port=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
fi
web_port=${web_port:-8080}
health_url="http://localhost:$web_port/api/health"

attempt=1
while [ "$attempt" -le 30 ]; do
  if curl -sf "$health_url" > /dev/null; then
    echo "Healthy after $attempt check(s)."
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "API did not become healthy at $health_url after 30 attempts (60s)." >&2
    docker compose logs --tail 50 backend >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "== Pruning unused Docker data =="
docker system prune -a -f

echo "Done."
