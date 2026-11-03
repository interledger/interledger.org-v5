#!/bin/sh
# Runs the CMS image locally under the same constraints as the Kubernetes pod, and
# checks the full lifecycle:
#
#   1. cms-init-repo clones the branch onto a fresh volume.
#   2. Strapi starts on that volume and answers /_health.
#   3. cms-sync-all clones the branch again and runs sync:all against Strapi.
#   4. cms-init-repo and Strapi start again on the used volume.
#
# Every container runs with a read-only root filesystem, as UID 1337, with a
# writable /tmp. Git sync is off, so nothing is pushed.
#
# Usage, from the repository root:
#
#   docker build -f cms/Dockerfile -t interledger-org-cms:local .
#   sh cms/docker/smoke-test.sh
#
# Environment:
#   IMAGE         image to test. Default: interledger-org-cms:local
#   GIT_BRANCH    branch to clone. Default: staging
#   GIT_REPO_URL  repository to clone. Default: this checkout, mounted read-only.
#   KEEP=true     keep the containers, network and volume for inspection
set -eu

IMAGE="${IMAGE:-interledger-org-cms:local}"
GIT_BRANCH="${GIT_BRANCH:-staging}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GIT_REPO_URL="${GIT_REPO_URL:-/src}"
KEEP="${KEEP:-false}"

NAME="cms-smoke-$$"
VOLUME="$NAME-data"
NETWORK="$NAME-net"
STRAPI="$NAME-strapi"

HEALTH_ATTEMPTS=90
HEALTH_INTERVAL_SECONDS=2

log() { echo "[smoke-test] $*"; }
fail() { echo "[smoke-test] FAILED: $*" >&2; exit 1; }

cleanup() {
  if [ "$KEEP" = "true" ]; then
    log "Kept: container $STRAPI, network $NETWORK, volume $VOLUME"
    return
  fi
  docker rm -f "$STRAPI" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -f "$ENV_FILE" "$GITCONFIG_FILE"
}
trap cleanup EXIT

random_secret() { head -c 24 /dev/urandom | base64; }

# The environment of the strapi-env ConfigMap, plus throwaway Strapi secrets.
ENV_FILE="$(mktemp)"
cat > "$ENV_FILE" <<EOF
GIT_REPO_URL=$GIT_REPO_URL
GIT_BRANCH=$GIT_BRANCH
GIT_REPO_PATH=/data/repo
STRAPI_PROJECT_ROOT=/data/repo
STRAPI_GIT_SYNC_REPO_PATH=/data/repo
STRAPI_PUBLIC_DIR=/data/repo/public
DATABASE_FILENAME=/data/db/data.db
DB_BOOTSTRAP=create
STRAPI_DISABLE_GIT_SYNC=true
SYNC_FORCE=true
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
HOME=/tmp
TMPDIR=/tmp
STRAPI_TELEMETRY_DISABLED=true
ASTRO_PREVIEW_URL=http://localhost:1103
GIT_COMMITTER_NAME=strapi
GIT_COMMITTER_EMAIL=strapi@interledger.org
GIT_AUTHOR_NAME=strapi
GIT_AUTHOR_EMAIL=strapi@interledger.org
GIT_TERMINAL_PROMPT=0
GIT_CONFIG_COUNT=2
GIT_CONFIG_KEY_0=safe.directory
GIT_CONFIG_VALUE_0=/data/repo
GIT_CONFIG_KEY_1=pull.rebase
GIT_CONFIG_VALUE_1=true
APP_KEYS=$(random_secret),$(random_secret)
API_TOKEN_SALT=$(random_secret)
ADMIN_JWT_SECRET=$(random_secret)
TRANSFER_TOKEN_SALT=$(random_secret)
JWT_SECRET=$(random_secret)
CI_API_TOKEN_OUTPUT_PATH=/data/ci-api-token
GIT_CONFIG_GLOBAL=/etc/smoke-gitconfig
EOF

# The default GIT_REPO_URL is this checkout, which another UID owns. For a clone
# source, git reads safe.directory only from global or system config, not from the
# GIT_CONFIG_* environment. The pod clones from GitHub and does not need this.
GITCONFIG_FILE="$(mktemp)"
printf '[safe]\n\tdirectory = *\n' > "$GITCONFIG_FILE"
chmod 644 "$ENV_FILE" "$GITCONFIG_FILE"

# The pod's constraints: read-only root, UID 1337, writable /tmp.
run_pod_container() {
  docker run --read-only --tmpfs /tmp:exec --user 1337:1337 \
    --env-file "$ENV_FILE" --network "$NETWORK" \
    -v "$VOLUME:/data" -v "$REPO_ROOT:/src:ro" \
    -v "$GITCONFIG_FILE:/etc/smoke-gitconfig:ro" "$@"
}

run_init() {
  run_pod_container --rm --entrypoint cms-init-repo "$IMAGE" || fail "cms-init-repo exited non-zero"
}

start_strapi() {
  run_pod_container -d --name "$STRAPI" "$IMAGE" >/dev/null
  attempt=1
  until docker exec "$STRAPI" node -e \
    "fetch('http://localhost:1337/_health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" \
    2>/dev/null; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$STRAPI")" != "true" ]; then
      docker logs --tail 50 "$STRAPI"
      fail "Strapi exited"
    fi
    if [ "$attempt" -ge "$HEALTH_ATTEMPTS" ]; then
      docker logs --tail 50 "$STRAPI"
      fail "Strapi did not become healthy"
    fi
    attempt=$((attempt + 1))
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
  log "Strapi is healthy"
}

stop_strapi() {
  docker stop --time 60 "$STRAPI" >/dev/null
  docker rm "$STRAPI" >/dev/null
}

main() {
  docker network create "$NETWORK" >/dev/null
  docker volume create "$VOLUME" >/dev/null
  # On Kubernetes, fsGroup 1337 makes the volume writable. Docker has no fsGroup.
  docker run --rm --user 0 -v "$VOLUME:/data" --entrypoint chown "$IMAGE" 1337:1337 /data

  log "1. cms-init-repo on an empty volume"
  run_init

  log "2. Strapi on the fresh volume"
  start_strapi

  log "3. cms-sync-all against Strapi"
  token="$(docker exec "$STRAPI" cat /data/ci-api-token)"
  run_pod_container --rm --entrypoint cms-sync-all \
    -e GIT_REPO_PATH=/tmp/repo -e "STRAPI_URL=http://$STRAPI:1337" -e "STRAPI_API_TOKEN=$token" \
    "$IMAGE" || fail "cms-sync-all exited non-zero"

  log "4. Restart on the used volume"
  stop_strapi
  run_init
  start_strapi

  log "PASSED"
}

main
