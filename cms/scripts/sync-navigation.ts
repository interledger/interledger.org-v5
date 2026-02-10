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
import { loadEnv } from './sync-mdx/env'
import { DEFAULT_STRAPI_URL } from './sync-mdx/config'

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
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
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

async function main() {
  const cwd = process.cwd()
  if (path.basename(cwd) !== 'cms') {
    console.error('❌ Error: run this script from the cms directory')
    console.error('   Example: cd cms && bun run sync:navigation')
    process.exit(1)
  }

  const projectRoot = path.resolve(cwd, '..')
  loadEnv(projectRoot)

  const STRAPI_URL = process.env.STRAPI_URL || DEFAULT_STRAPI_URL
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

  if (!STRAPI_TOKEN) {
    console.error('❌ Error: STRAPI_API_TOKEN not set')
    process.exit(1)
  }

  const configs = [
    {
      apiId: 'foundation-navigation',
      configPath: path.join(projectRoot, 'src/config/foundation-navigation.json'),
      label: 'foundation navigation'
    },
    {
      apiId: 'summit-navigation',
      configPath: path.join(projectRoot, 'src/config/summit-navigation.json'),
      label: 'summit navigation'
    }
  ]

  for (const config of configs) {
    await updateNavigation({
      baseUrl: STRAPI_URL,
      token: STRAPI_TOKEN,
      apiId: config.apiId,
      configPath: config.configPath,
      label: config.label
    })
  }

  if (DRY_RUN) {
    console.log('\n💡 This was a dry-run. Run without --dry-run to apply changes.')
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
