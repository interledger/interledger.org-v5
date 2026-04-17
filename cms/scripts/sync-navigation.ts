#!/usr/bin/env node

/**
 * Foundation/Summit navigation JSON to Strapi Sync Script
 *
 * Usage:
 *   pnpm run sync:navigation:dry-run
 *   pnpm run sync:navigation
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { spawnSync } from 'child_process'
import { LOCALES, defaultLang } from '@/utils/mdx'
import { assertRunFromCms, getConfigPath, getProjectRoot } from '@/utils'
import { assertStrapiRunning } from './ensureStrapiRunning'
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

interface MenuItem {
  label: string
  href?: string
  openInNewTab?: boolean
}

interface MenuGroup {
  label: string
  href?: string
  items?: MenuItem[]
}

interface Navigation {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}

interface StrapiMenuItem {
  label: string
  href?: string
  openInNewTab?: boolean
}

interface StrapiMenuGroup {
  label: string
  href?: string
  items?: StrapiMenuItem[]
}

interface StrapiPayload {
  data: {
    mainMenu: StrapiMenuGroup[]
    ctaButton?: StrapiMenuItem | null
  }
}

function readJson(filepath: string): Navigation {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Config file not found: ${filepath}`)
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch (error) {
    throw new Error(
      `Failed to read or parse config file: ${filepath}: ${error instanceof Error ? error.message : error}`,
      { cause: error }
    )
  }
}

function toStrapiPayload(navigation: Navigation): StrapiPayload {
  const mapItem = (item: MenuItem | undefined): StrapiMenuItem | null => {
    if (!item) return null
    const payload: StrapiMenuItem = { label: item.label }
    if (item.href) payload.href = item.href
    if (item.openInNewTab) payload.openInNewTab = true
    return payload
  }

  const mainMenu = (navigation.mainMenu || []).map((group): StrapiMenuGroup => {
    const groupData: StrapiMenuGroup = { label: group.label }
    if (group.href) groupData.href = group.href
    if (group.items && group.items.length > 0) {
      groupData.items = group.items
        .map(mapItem)
        .filter((item): item is StrapiMenuItem => item !== null)
    }
    return groupData
  })

  const data: StrapiPayload['data'] = { mainMenu }
  if (navigation.ctaButton) {
    data.ctaButton = mapItem(navigation.ctaButton)
  }

  return { data }
}

interface UpdateNavigationOptions {
  baseUrl: string
  token: string
  apiId: string
  configPath: string
  locale: string
  label: string
}

async function updateNavigation({
  baseUrl,
  token,
  apiId,
  configPath,
  locale,
  label
}: UpdateNavigationOptions) {
  if (!fs.existsSync(configPath)) {
    console.log(
      `⏭️  Skipping ${label} [${locale}]: file not found (${configPath})`
    )
    return
  }

  const navigation = readJson(configPath)
  const payload = toStrapiPayload(navigation)
  const url = `${baseUrl}/api/${apiId}?publicationState=preview&locale=${locale}`

  if (DRY_RUN) {
    console.log(`🔍 [DRY-RUN] Would update ${label} [${locale}]: ${configPath}`)
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-skip-mdx-export': 'true' // Skip lifecycle git sync - sync script is import-only
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Failed to sync ${label} [${locale}]: ${res.status} - ${text}`
    )
  }

  const result = (await res.json()) as { data: { documentId: string } }
  console.log(
    `✅ Synced ${label} [${locale}] (documentId: ${result.data.documentId})`
  )
}

async function syncAllNavigations(
  projectRoot: string,
  baseUrl: string,
  token: string
) {
  const navigations = [
    {
      apiId: 'foundation-navigation',
      configKey: 'foundationNavigation' as const,
      label: 'foundation navigation'
    },
    {
      apiId: 'summit-navigation',
      configKey: 'summitNavigation' as const,
      label: 'summit navigation'
    }
  ]

  for (const nav of navigations) {
    const basePath = getConfigPath(projectRoot, nav.configKey)
    for (const locale of LOCALES) {
      const configPath =
        locale === defaultLang
          ? basePath
          : basePath.replace(/\.json$/, `.${locale}.json`)
      await updateNavigation({
        baseUrl,
        token,
        apiId: nav.apiId,
        configPath,
        locale,
        label: nav.label
      })
    }
  }
}

async function main() {
  assertRunFromCms()
  const projectRoot = getProjectRoot()

  if (!DRY_RUN && !FORCE) {
    const branch = spawnSync('git', ['branch', '--show-current'], {
      encoding: 'utf-8',
      cwd: projectRoot
    })
    const currentBranch = branch.stdout?.trim()
    const allowedBranches = ['main', 'staging']
    if (!allowedBranches.includes(currentBranch || '')) {
      console.error(
        `❌ Error: sync-navigation can only run on ${allowedBranches.join(' or ')} branch (use --dry-run to preview, --force to override)`
      )
      console.error(`   Current branch: ${currentBranch || '(unknown)'}`)
      process.exit(1)
    }
  }
  const envPath = path.join(projectRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }

  const STRAPI_URL = process.env.STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

  if (!STRAPI_URL) {
    console.error('❌ Error: STRAPI_URL not set')
    console.error(
      '   Add STRAPI_URL to your .env file (e.g. STRAPI_URL=http://localhost:1337)'
    )
    process.exit(1)
  }
  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN not set')
    process.exit(1)
  }

  await assertStrapiRunning(STRAPI_URL)
  await syncAllNavigations(projectRoot, STRAPI_URL, STRAPI_TOKEN)

  if (DRY_RUN) {
    console.log(
      '\n💡 This was a dry-run. Run without --dry-run to apply changes.'
    )
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
