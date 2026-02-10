#!/usr/bin/env bun

/**
 * MDX to Strapi Sync Script
 *
 * Usage:
 *   bun scripts/sync-mdx/index.ts --dry-run
 *   bun scripts/sync-mdx/index.ts
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { DEFAULT_STRAPI_URL, buildContentTypes } from './config'
import { createStrapiClient } from './strapi'
import { syncAll } from './sync'

async function main() {
  console.log('🚀 MDX → Strapi Sync')
  console.log('='.repeat(50))

  const cwd = process.cwd()
  if (path.basename(cwd) !== 'cms') {
    console.error('❌ Error: run this script from the cms directory')
    console.error('   Example: cd cms && bun run sync:mdx')
    process.exit(1)
  }

  const projectRoot = path.resolve(cwd, '..')
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const STRAPI_URL = process.env.STRAPI_URL || DEFAULT_STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN
  const DRY_RUN = process.argv.includes('--dry-run')

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
