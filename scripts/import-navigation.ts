/**
 * Import navigation from local JSON config to Strapi
 * Handles both regular navigation and summit navigation
 *
 * Usage:
 *   npx tsx scripts/import-navigation.ts [--summit]
 *   or
 *   npx tsx scripts/import-navigation.ts --all
 *
 * Requires STRAPI_URL and STRAPI_API_TOKEN environment variables
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load .env file
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

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

async function importNavigation(type: 'regular' | 'summit' | 'all') {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_API_TOKEN

  const typesToImport: ('regular' | 'summit')[] =
    type === 'all' ? ['regular', 'summit'] : [type]

  interface StrapiMenuItemData {
    label: string
    href?: string | null
    openInNewTab?: boolean
  }

  interface StrapiMenuGroupData {
    label: string
    href?: string | null
    items?: StrapiMenuItemData[]
  }

  interface StrapiNavigationPayload {
    data: {
      mainMenu: StrapiMenuGroupData[]
      ctaButton?: StrapiMenuItemData | null
    }
  }

  for (const navType of typesToImport) {
    const isSummit = navType === 'summit'
    const configPath = join(
      process.cwd(),
      `src/config/${isSummit ? 'summit-' : ''}navigation.json`
    )
    const apiPath = isSummit ? 'summit-navigation' : 'navigation'
    const displayName = isSummit ? 'summit navigation' : 'navigation'

    console.log(`\nImporting ${displayName}...`)

    if (!existsSync(configPath)) {
      console.warn(`  Config file not found: ${configPath}`)
      continue
    }

    const navigation: Navigation = JSON.parse(readFileSync(configPath, 'utf-8'))

    // Transform to Strapi format
    const strapiData: StrapiNavigationPayload = {
      data: {
        mainMenu: navigation.mainMenu.map((group): StrapiMenuGroupData => {
          const groupData: StrapiMenuGroupData = {
            label: group.label
          }
          if (group.href) {
            groupData.href = group.href
          }
          if (group.items && group.items.length > 0) {
            groupData.items = group.items.map((item): StrapiMenuItemData => {
              const itemData: StrapiMenuItemData = {
                label: item.label
              }
              if (item.href) {
                itemData.href = item.href
              }
              if (item.openInNewTab) {
                itemData.openInNewTab = true
              }
              return itemData
            })
          }
          return groupData
        })
      }
    }

    if (navigation.ctaButton) {
      const ctaData: StrapiMenuItemData = {
        label: navigation.ctaButton.label
      }
      if (navigation.ctaButton.href) {
        ctaData.href = navigation.ctaButton.href
      }
      if (navigation.ctaButton.openInNewTab) {
        ctaData.openInNewTab = true
      }
      strapiData.data.ctaButton = ctaData
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Single types in Strapi v5 use document API endpoint
    const url = `${baseUrl}/api/${apiPath}?publicationState=preview`
    console.log(`  Updating ${displayName} (single type uses PUT)...`)

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(strapiData)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `Failed to import ${displayName}: ${res.status} - ${text}`
      )
    }

    const result = await res.json()
    console.log(`  ${displayName} imported successfully!`)
    console.log(`  Document ID: ${result.data.documentId}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  let type: 'regular' | 'summit' | 'all' = 'regular'

  if (args.includes('--summit')) {
    type = 'summit'
  } else if (args.includes('--all')) {
    type = 'all'
  }

  try {
    await importNavigation(type)
  } catch (error) {
    console.error('Error importing navigation:', error)
    process.exit(1)
  }
}

main()
