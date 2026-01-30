/**
 * Import navigation from local JSON config to Strapi
 * 
 * Usage: npx tsx scripts/import-navigation.ts
 * 
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { readFileSync } from 'fs'
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

async function importNavigation() {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  // Read local navigation config
  const configPath = join(process.cwd(), 'src/config/navigation.json')
  const navigation: Navigation = JSON.parse(readFileSync(configPath, 'utf-8'))

  // Transform to Strapi format
  const strapiData = {
    data: {
      mainMenu: navigation.mainMenu.map((group) => ({
        label: group.label,
        href: group.href || null,
        items: (group.items || []).map((item) => ({
          label: item.label,
          href: item.href || null,
          openInNewTab: item.openInNewTab || false
        }))
      })),
      ctaButton: navigation.ctaButton ? {
        label: navigation.ctaButton.label,
        href: navigation.ctaButton.href || null,
        openInNewTab: navigation.ctaButton.openInNewTab || false
      } : null
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Single types in Strapi always use PUT (create or update)
  const url = `${baseUrl}/api/navigation`
  console.log('Updating navigation (single type uses PUT)...')

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(strapiData)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to import navigation: ${res.status} - ${text}`)
  }

  const result = await res.json()
  console.log('Navigation imported successfully!')
  console.log(`Document ID: ${result.data.documentId}`)
}

async function main() {
  console.log('Importing navigation to Strapi...')
  
  try {
    await importNavigation()
  } catch (error) {
    console.error('Error importing navigation:', error)
    process.exit(1)
  }
}

main()
