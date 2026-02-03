/**
 * Export pages from Strapi Pages collection to local MDX files
 *
 * Usage: npx tsx scripts/export-pages.ts
 *
 * Fetches all pages from Strapi Pages collection and writes them to src/content/pages/
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'

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

interface CtaLink {
  text: string
  link: string
  style?: string
  external?: boolean
  analytics_event_label?: string
}

interface Hero {
  title: string
  description?: string
  primaryCta?: CtaLink
  secondaryCtas?: CtaLink[]
}

interface Seo {
  metaTitle: string
  metaDescription?: string
  keywords?: string
}

interface Block {
  __component: string
  [key: string]: unknown
}

interface Page {
  slug: string
  title: string
  seo?: Seo
  hero?: Hero
  heroTitle?: string
  heroDescription?: string
  content?: Block[]
  mdxContent?: string
}

async function fetchAllPages(): Promise<Page[]> {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  const url = `${baseUrl}/api/pages?populate[hero][populate]=*&populate[content][populate]=*&populate[seo][populate]=*`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })

  if (!res.ok) {
    throw new Error(`Failed to fetch pages: ${res.status}`)
  }

  const json = await res.json()
  return json.data || []
}

function blockToMdx(block: Block): string {
  const component = block.__component

  switch (component) {
    case 'blocks.paragraph':
      return block.content as string

    case 'blocks.cards-grid': {
      const cards =
        (block.cards as Array<{
          title: string
          description?: string
          link?: string
          linkText?: string
        }>) || []
      let mdx = ''
      if (block.heading) mdx += `## ${block.heading}\n\n`
      if (block.subheading) mdx += `${block.subheading}\n\n`
      mdx += '<div class="cards-grid">\n\n'
      for (const card of cards) {
        mdx += `### ${card.title}\n\n`
        if (card.description) mdx += `${card.description}\n\n`
        if (card.link)
          mdx += `[${card.linkText || 'Learn more'}](${card.link})\n\n`
      }
      mdx += '</div>\n'
      return mdx
    }

    case 'blocks.card-links-grid': {
      const cards =
        (block.cards as Array<{
          title: string
          description?: string
          href: string
        }>) || []
      let mdx = ''
      if (block.heading) mdx += `## ${block.heading}\n\n`
      if (block.subheading) mdx += `${block.subheading}\n\n`
      mdx += '<div class="card-links">\n\n'
      for (const card of cards) {
        mdx += `- [${card.title}](${card.href})`
        if (card.description) mdx += ` - ${card.description}`
        mdx += '\n'
      }
      mdx += '\n</div>\n'
      return mdx
    }

    case 'blocks.cta-banner': {
      let mdx = '<div class="cta-banner">\n\n'
      if (block.heading) mdx += `## ${block.heading}\n\n`
      if (block.text) mdx += `${block.text}\n\n`
      if (block.primaryButtonText && block.primaryButtonLink) {
        mdx += `[${block.primaryButtonText}](${block.primaryButtonLink})\n`
      }
      if (block.secondaryButtonText && block.secondaryButtonLink) {
        mdx += `[${block.secondaryButtonText}](${block.secondaryButtonLink})\n`
      }
      mdx += '\n</div>\n'
      return mdx
    }

    case 'blocks.carousel': {
      const items =
        (block.items as Array<{
          quote: string
          author?: string
          role?: string
          organization?: string
        }>) || []
      let mdx = ''
      if (block.heading) mdx += `## ${block.heading}\n\n`
      mdx += '<div class="carousel">\n\n'
      for (const item of items) {
        mdx += `> ${item.quote}\n`
        if (item.author) {
          mdx += `> — ${item.author}`
          if (item.role) mdx += `, ${item.role}`
          if (item.organization) mdx += ` at ${item.organization}`
          mdx += '\n'
        }
        mdx += '\n'
      }
      mdx += '</div>\n'
      return mdx
    }

    default:
      console.warn(`Unknown block type: ${component}`)
      return `<!-- Unknown block: ${component} -->\n`
  }
}

function pageToMdx(page: Page): string {
  const frontmatter: Record<string, unknown> = {
    slug: page.slug,
    title: page.seo?.metaTitle || page.title
  }

  // Add hero fields if present
  if (page.hero) {
    frontmatter.heroTitle = page.hero.title
    if (page.hero.description) {
      frontmatter.heroDescription = page.hero.description
    }

    // Add hero CTAs to frontmatter
    if (
      page.hero.primaryCta ||
      (page.hero.secondaryCtas && page.hero.secondaryCtas.length > 0)
    ) {
      const ctas: CtaLink[] = []
      if (page.hero.primaryCta) {
        ctas.push({ ...page.hero.primaryCta, style: 'primary' })
      }
      if (page.hero.secondaryCtas) {
        ctas.push(
          ...page.hero.secondaryCtas.map((cta) => ({
            ...cta,
            style: 'secondary'
          }))
        )
      }
      frontmatter.heroCtas = ctas
    }
  } else {
    // Fallback to flat hero fields
    if (page.heroTitle) frontmatter.heroTitle = page.heroTitle
    if (page.heroDescription) frontmatter.heroDescription = page.heroDescription
  }

  // Build MDX content
  let mdx = '---\n'
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'string') {
      // Escape quotes in strings
      mdx += `${key}: "${value.replace(/"/g, '\\"')}"\n`
    } else if (Array.isArray(value)) {
      mdx += `${key}:\n`
      for (const item of value) {
        mdx += `  - text: "${(item as CtaLink).text}"\n`
        mdx += `    link: "${(item as CtaLink).link}"\n`
        if ((item as CtaLink).style)
          mdx += `    style: "${(item as CtaLink).style}"\n`
        if ((item as CtaLink).external) mdx += `    external: true\n`
      }
    } else {
      mdx += `${key}: ${JSON.stringify(value)}\n`
    }
  }
  mdx += '---\n\n'

  // Add content blocks if present
  if (page.content && page.content.length > 0) {
    for (const block of page.content) {
      mdx += blockToMdx(block)
      mdx += '\n'
    }
  } else if (page.mdxContent) {
    // Fallback to raw mdxContent if no structured blocks
    mdx += page.mdxContent
  }

  return mdx
}

async function main() {
  console.log('Fetching pages from Strapi...')

  try {
    const pages = await fetchAllPages()

    if (pages.length === 0) {
      console.log('No pages found in Strapi')
      return
    }

    console.log(`Found ${pages.length} page(s) to export\n`)

    const outputDir = join(process.cwd(), 'src/content/pages')
    mkdirSync(outputDir, { recursive: true })

    for (const page of pages) {
      const mdxContent = pageToMdx(page)
      const filename = page.slug === 'home' ? 'home.mdx' : `${page.slug}.mdx`
      const outputPath = join(outputDir, filename)

      writeFileSync(outputPath, mdxContent)
      console.log(`  ✓ ${filename}`)
    }

    console.log('\nPages export complete!')
  } catch (error) {
    console.error('Error exporting pages:', error)
    process.exit(1)
  }
}

main()
