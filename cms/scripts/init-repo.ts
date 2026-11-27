/**
 * Entry point of `cms-init-repo`, the init container of the Strapi pod.
 * See `initRepo.ts` for what it does, and the README of interledger/frontend-deploy
 * for the environment contract.
 *
 * Environment:
 *   GIT_REPO_URL             repository to clone
 *   GIT_BRANCH               branch the checkout follows
 *   GIT_REPO_PATH            folder of the checkout
 *   DATABASE_FILENAME        absolute path of the SQLite database
 *   DB_BOOTSTRAP             wait (default): wait until DATABASE_FILENAME exists. create: do not wait.
 *   DB_POLL_SECONDS          seconds between checks for the database file. Default: 5
 *   STRAPI_DISABLE_GIT_SYNC  true: never push
 *   RESET_TOKEN              optional. A value that differs from the stored one resets.
 */
import { initRepo, readInitRepoConfig } from './initRepo'

function fail(error: Error): never {
  console.error(`[cms-init-repo] ERROR: ${error.message}`)
  if (error.cause instanceof Error) console.error(error.cause.message)
  process.exit(1)
}

async function main(): Promise<void> {
  const config = readInitRepoConfig(process.env)
  if (config instanceof Error) fail(config)

  const result = await initRepo(config)
  if (result instanceof Error) fail(result)
}

void main()
