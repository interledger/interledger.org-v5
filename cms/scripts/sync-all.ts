/**
 * Run all sync scripts in order: images → mdx → navigation.
 *
 * Usage:
 *   pnpm run sync:all            # normal (branch check enforced for mdx and navigation)
 *   pnpm run sync:all --force    # bypass branch check for mdx and navigation
 */

import { execSync } from 'child_process'

const FORCE = process.argv.includes('--force')

const scripts = [
  'pnpm run sync:images',
  `pnpm run sync:mdx${FORCE ? ' -- --force' : ''}`,
  `pnpm run sync:navigation${FORCE ? ' -- --force' : ''}`
]

for (const cmd of scripts) {
  console.log(`\n▶ ${cmd}\n`)
  execSync(cmd, { stdio: 'inherit' })
}
