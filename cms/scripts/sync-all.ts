/**
 * Run all sync scripts in order: images → mdx → navigation.
 *
 * Usage:
 *   pnpm run sync:all            # normal (branch check enforced for mdx and navigation)
 *   pnpm run sync:all --force    # bypass branch check for mdx and navigation
 */

import { spawnSync } from 'child_process'

const FORCE = process.argv.includes('--force')

const scripts = [
  'pnpm run sync:images',
  `pnpm run sync:mdx${FORCE ? ' -- --force' : ''}`,
  `pnpm run sync:navigation${FORCE ? ' -- --force' : ''}`
]

for (const cmd of scripts) {
  console.log(`\n▶ ${cmd}\n`)
  const result = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true
  })

  if (result.status !== 0) {
    console.error(`\n❌ sync:all stopped because "${cmd}" failed.`)
    process.exit(result.status ?? 1)
  }
}
