/**
 * Sync navigation from Strapi to local JSON config
 *
 * Usage: npx tsx scripts/sync-navigation.ts
 *
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
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

interface StrapiNavigationData {
  mainMenu?: StrapiMenuGroup[]
  ctaButton?: StrapiMenuItem
}

async function fetchNavigation(): Promise<StrapiNavigationData> {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  const url = `${baseUrl}/api/navigation?populate[mainMenu][populate]=items&populate[ctaButton]=true`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })

  if (!res.ok) {
    throw new Error(`Failed to fetch navigation: ${res.status}`)
  }

  const json = await res.json()
  return json.data as StrapiNavigationData
}

function transformNavigation(data: StrapiNavigationData): Navigation {
  const mainMenu = (data.mainMenu || []).map((group: StrapiMenuGroup) => ({
    label: group.label,
    ...(group.href && { href: group.href }),
    items: (group.items || []).map((item: StrapiMenuItem) => ({
      label: item.label,
      ...(item.href && { href: item.href }),
      ...(item.openInNewTab && { openInNewTab: true })
    }))
  }))

  const result: Navigation = { mainMenu }

  if (data.ctaButton) {
    result.ctaButton = {
      label: data.ctaButton.label,
      ...(data.ctaButton.href && { href: data.ctaButton.href }),
      ...(data.ctaButton.openInNewTab && { openInNewTab: true })
    }
  }

  return result
}

async function main() {
  console.log('Fetching navigation from Strapi...')

  try {
    const strapiData = await fetchNavigation()
    const navigation = transformNavigation(strapiData)

    const outputPath = join(process.cwd(), 'src/config/navigation.json')
    writeFileSync(outputPath, JSON.stringify(navigation, null, 2))

    console.log(`Navigation synced to ${outputPath}`)
  } catch (error) {
    console.error('Error syncing navigation:', error)
    process.exit(1)
  }
}

main()
