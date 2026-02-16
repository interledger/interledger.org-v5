#!/usr/bin/env bun

/**
 * MDX to Strapi Sync Script
 *
 * Usage (run from cms/):
 *   bun run sync:mdx:dry-run
 *   bun run sync:mdx
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import { assertRunFromCms, getProjectRoot } from '../../src/utils/paths'
import { buildContentTypes } from './config'
import { createStrapiClient } from './strapiClient'
import { syncAll } from './sync'

async function main() {
  console.log('🚀 MDX → Strapi Sync')
  console.log('='.repeat(50))

  assertRunFromCms()

  const projectRoot = getProjectRoot()
  const DRY_RUN = process.argv.includes('--dry-run')
  if (!DRY_RUN) {
    const branch = spawnSync('git', ['branch', '--show-current'], {
      encoding: 'utf-8',
      cwd: projectRoot
    })
    const currentBranch = branch.stdout?.trim()
    // if (currentBranch !== 'main') {
    //   console.error('❌ Error: sync-mdx can only run on the main branch (use --dry-run to preview)')
    //   console.error(`   Current branch: ${currentBranch || '(unknown)'}`)
    //   process.exit(1)
    // }
  }

  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const STRAPI_URL = process.env.STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

  if (!STRAPI_URL) {
    console.error('❌ Error: STRAPI_URL not set')
    console.error('   Add STRAPI_URL to your .env file (e.g. STRAPI_URL=http://localhost:1337)')
    process.exit(1)
  }
  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN not set')
    process.exit(1)
  }

  console.log(`🔗 Connecting to: ${STRAPI_URL}`)

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN MODE - No changes will be made\n')
  }

  const contentTypes = buildContentTypes(projectRoot)
  const strapi = createStrapiClient({ baseUrl: STRAPI_URL, token: STRAPI_TOKEN })

  const results = await syncAll({
    contentTypes,
    strapi,
    DRY_RUN
  })

  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary')
  console.log('='.repeat(50))
  console.log(`   ✅ Created: ${results.created}`)
  console.log(`   🔄 Updated: ${results.updated}`)
  console.log(`   🗑️  Deleted: ${results.deleted}`)
  console.log(`   ❌ Errors:  ${results.errors}`)

  if (DRY_RUN) {
    console.log('\n💡 This was a dry-run. Run without --dry-run to apply changes.')
  }

  process.exit(results.errors > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
