#!/usr/bin/env bash
# Invoked by the strapi-content-sync-<branch>.timer systemd unit (installed by
# ensure-sync-schedule in .github/workflows/merge.yml) to run the content sync
# daily instead of on every commit. Relies on the repo root .env already
# present on the Strapi VM for STRAPI_URL/STRAPI_API_TOKEN, same as
# `pnpm run start`/`develop`. SYNC_FORCE is set as an Environment= line on the
# systemd service (mirroring ENV_SYNC_FORCE in the workflow_dispatch sync job)
# so both sync paths bypass the branch check the same way.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ "${SYNC_FORCE:-false}" = "true" ]; then
  pnpm run sync:all --force
else
  pnpm run sync:all
fi
