/**
 * Sync navigation from Strapi to local JSON config
 * 
 * Usage: npx tsx scripts/sync-navigation.ts
 * 
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

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

async function fetchNavigation(): Promise<Navigation> {
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
  return json.data
}

function transformNavigation(data: any): Navigation {
  const mainMenu = (data.mainMenu || []).map((group: any) => ({
    label: group.label,
    ...(group.href && { href: group.href }),
    items: (group.items || []).map((item: any) => ({
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
    const data = await fetchNavigation()
    const navigation = transformNavigation(data)
    
    const outputPath = join(process.cwd(), 'src/config/navigation.json')
    writeFileSync(outputPath, JSON.stringify(navigation, null, 2))
    
    console.log(`Navigation synced to ${outputPath}`)
  } catch (error) {
    console.error('Error syncing navigation:', error)
    process.exit(1)
  }
}

main()
