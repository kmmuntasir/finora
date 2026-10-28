#!/usr/bin/env bash
# Builds Finora and updates an existing LXC (or any Debian host) set up as in
# .knowledge/deploy/production.md: nginx serving /var/www/finora and the
# finora-api systemd unit. The host's config.json and /etc/finora/api.env are
# kept as they are.
#
# Usage (from the repository root): deploy/deploy-lxc.sh [web|api|all]
# Reads FINORA_DEPLOY_HOST (user@host) and optional FINORA_DEPLOY_JUMP
# (user@jump:port) from the environment or the git-ignored .env.deploy.
set -euo pipefail

part="${1:-all}"
case "$part" in web | api | all) ;; *) echo "Usage: $0 [web|api|all]" >&2; exit 1 ;; esac

[ -f .env.deploy ] && . ./.env.deploy
: "${FINORA_DEPLOY_HOST:?Set FINORA_DEPLOY_HOST (user@host), for example in .env.deploy}"
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10)
[ -n "${FINORA_DEPLOY_JUMP:-}" ] && ssh_opts+=(-J "$FINORA_DEPLOY_JUMP")

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

if [ "$part" != api ]; then
  (cd web && pnpm install --frozen-lockfile >/dev/null && pnpm build >/dev/null)
  cp -r web/dist "$stage/dist"
  rm -f "$stage/dist/config.json"
fi
if [ "$part" != web ]; then
  (cd api && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o "$stage/finora-api" ./cmd/finora-api)
fi

tar -C "$stage" -czf - . |
  ssh "${ssh_opts[@]}" "$FINORA_DEPLOY_HOST" 'rm -rf /tmp/finora-release && mkdir /tmp/finora-release && tar -C /tmp/finora-release -xzf -'

ssh "${ssh_opts[@]}" "$FINORA_DEPLOY_HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /tmp/finora-release
if [ -d dist ]; then
  # Swap in the new files but keep this host's config.json.
  cp /var/www/finora/config.json dist/config.json
  chmod -R a+rX dist
  rm -rf /var/www/finora.old
  mv /var/www/finora /var/www/finora.old && mv dist /var/www/finora
  rm -rf /var/www/finora.old
  echo "web updated"
fi
if [ -f finora-api ]; then
  install -m 755 finora-api /usr/local/bin/finora-api
  systemctl restart finora-api
  sleep 2
  systemctl is-active --quiet finora-api && echo "api restarted"
fi
cd / && rm -rf /tmp/finora-release
REMOTE
