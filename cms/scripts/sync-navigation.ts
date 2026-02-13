#!/usr/bin/env bun

/**
 * Foundation/Summit navigation JSON to Strapi Sync Script
 *
 * Usage:
 *   bun scripts/sync-navigation.ts --dry-run
 *   bun scripts/sync-navigation.ts
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { assertRunFromCms, getConfigPath, getProjectRoot } from '../src/utils/paths'
const DRY_RUN = process.argv.includes('--dry-run')

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
    throw new Error(`Failed to read or parse config file: ${filepath}: ${error instanceof Error ? error.message : error}`)
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
      groupData.items = group.items.map(mapItem).filter((item): item is StrapiMenuItem => item !== null)
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
  label: string
}

async function updateNavigation({ baseUrl, token, apiId, configPath, label }: UpdateNavigationOptions) {
  const navigation = readJson(configPath)
  const payload = toStrapiPayload(navigation)
  const url = `${baseUrl}/api/${apiId}?publicationState=preview`

  if (DRY_RUN) {
    console.log(`🔍 [DRY-RUN] Would update ${label}: ${configPath}`)
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
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
    throw new Error(`Failed to sync ${label}: ${res.status} - ${text}`)
  }

  const result = await res.json() as { data: { documentId: string } }
  console.log(`✅ Synced ${label} (documentId: ${result.data.documentId})`)
}

async function syncAllNavigations(
  projectRoot: string,
  baseUrl: string,
  token: string
) {
  const configs = [
    {
      apiId: 'foundation-navigation',
      configPath: getConfigPath(projectRoot, 'foundationNavigation'),
      label: 'foundation navigation'
    },
    {
      apiId: 'summit-navigation',
      configPath: getConfigPath(projectRoot, 'summitNavigation'),
      label: 'summit navigation'
    }
  ]

  for (const config of configs) {
    await updateNavigation({
      baseUrl,
      token,
      apiId: config.apiId,
      configPath: config.configPath,
      label: config.label
    })
  }
}

async function main() {
  assertRunFromCms()
  const projectRoot = getProjectRoot()
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

  await syncAllNavigations(projectRoot, STRAPI_URL, STRAPI_TOKEN)

  if (DRY_RUN) {
    console.log('\n💡 This was a dry-run. Run without --dry-run to apply changes.')
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
