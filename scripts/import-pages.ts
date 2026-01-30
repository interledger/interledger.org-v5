/**
 * Import pages from local MDX files to Strapi
 * 
 * Usage: npx tsx scripts/import-pages.ts
 * 
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import matter from 'gray-matter'

interface PageFrontmatter {
  title: string
  slug: string
  description?: string
  heroTitle?: string
  heroDescription?: string
}

async function importPage(baseUrl: string, headers: Record<string, string>, page: {
  frontmatter: PageFrontmatter
  content: string
}) {
  // Check if page exists by slug
  const searchUrl = `${baseUrl}/api/pages?filters[slug][$eq]=${page.frontmatter.slug}`
  const searchRes = await fetch(searchUrl, { headers })
  const searchData = await searchRes.json()

  const strapiData = {
    data: {
      title: page.frontmatter.title,
      slug: page.frontmatter.slug,
      description: page.frontmatter.description || null,
      heroTitle: page.frontmatter.heroTitle || null,
      heroDescription: page.frontmatter.heroDescription || null,
      mdxContent: page.content
    }
  }

  let url: string
  let method: string

  if (searchData.data && searchData.data.length > 0) {
    // Update existing
    const existingId = searchData.data[0].id
    url = `${baseUrl}/api/pages/${existingId}`
    method = 'PUT'
    console.log(`Updating page: ${page.frontmatter.slug}`)
  } else {
    // Create new
    url = `${baseUrl}/api/pages`
    method = 'POST'
    console.log(`Creating page: ${page.frontmatter.slug}`)
  }

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(strapiData)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to import page ${page.frontmatter.slug}: ${res.status} - ${text}`)
  }

  return res.json()
}

async function main() {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const pagesDir = join(process.cwd(), 'src/content/pages')
  
  let files: string[]
  try {
    files = readdirSync(pagesDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'))
  } catch {
    console.log('No pages directory found at src/content/pages')
    return
  }

  console.log(`Found ${files.length} page(s) to import...\n`)

  for (const file of files) {
    const filePath = join(pagesDir, file)
    const fileContent = readFileSync(filePath, 'utf-8')
    const { data: frontmatter, content } = matter(fileContent)

    try {
      await importPage(baseUrl, headers, {
        frontmatter: frontmatter as PageFrontmatter,
        content
      })
      console.log(`  ✓ ${file}`)
    } catch (error) {
      console.error(`  ✗ ${file}: ${error}`)
    }
  }

  console.log('\nPages import complete!')
}

main()
