/**
 * Import summit navigation from local JSON config to Strapi
 *
 * Usage: npx tsx scripts/import-summit-navigation.ts
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

interface SummitNavigation {
  mainMenu: MenuGroup[]
  ctaButton?: MenuItem
}

async function importSummitNavigation() {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_API_TOKEN

  // Read local summit navigation config
  const configPath = join(process.cwd(), 'src/config/summit-navigation.json')
  const navigation: SummitNavigation = JSON.parse(
    readFileSync(configPath, 'utf-8')
  )

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
      ctaButton: navigation.ctaButton
        ? {
            label: navigation.ctaButton.label,
            href: navigation.ctaButton.href || null,
            openInNewTab: navigation.ctaButton.openInNewTab || false
          }
        : null
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Single types in Strapi always use PUT (create or update)
  const url = `${baseUrl}/api/summit-navigation`
  console.log('Updating summit navigation (single type uses PUT)...')

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(strapiData)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Failed to import summit navigation: ${res.status} - ${text}`
    )
  }

  const result = await res.json()
  console.log('Summit navigation imported successfully!')
  console.log(`Document ID: ${result.data.documentId}`)
}

async function main() {
  console.log('Importing summit navigation to Strapi...')

  try {
    await importSummitNavigation()
  } catch (error) {
    console.error('Error importing summit navigation:', error)
    process.exit(1)
  }
}

main()
