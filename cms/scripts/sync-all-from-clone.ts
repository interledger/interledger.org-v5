/**
 * Entry point of `cms-sync-all`, the content-sync Job. See `syncAllFromClone.ts`
 * for what it does, and the README of interledger/frontend-deploy for the
 * environment contract.
 *
 * Environment:
 *   GIT_REPO_URL      repository to clone
 *   GIT_BRANCH        branch to sync from
 *   GIT_REPO_PATH     folder for the clone. Its contents are deleted first.
 *   STRAPI_URL        the Strapi to sync into
 *   STRAPI_API_TOKEN  a full-access API token of that Strapi
 *   SYNC_FORCE        true: pass --force, which skips the sync scripts' branch check
 */
import {
  readSyncAllFromCloneConfig,
  syncAllFromClone
} from './syncAllFromClone'

function fail(error: Error): never {
  console.error(`[cms-sync-all] ERROR: ${error.message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const config = readSyncAllFromCloneConfig(process.env)
  if (config instanceof Error) fail(config)

  const exitCode = await syncAllFromClone(config)
  if (exitCode instanceof Error) fail(exitCode)
  process.exit(exitCode)
}

void main()
