/**
 * Sync Homepage from Strapi Pages collection to local MDX file
 *
 * Usage: npx tsx scripts/sync-homepage.ts
 *
 * Fetches the page with slug "home" from Strapi Pages collection
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

interface Homepage {
  seo?: Seo
  hero: Hero
  content?: Block[]
}

async function fetchHomepage(): Promise<Homepage | null> {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  // Fetch from Pages collection with slug "home"
  const url = `${baseUrl}/api/pages?filters[slug][$eq]=home&populate[hero][populate]=*&populate[content][populate]=*&populate[seo][populate]=*`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })

  if (!res.ok) {
    if (res.status === 404) {
      console.log('Homepage not found in Strapi Pages collection')
      return null
    }
    throw new Error(`Failed to fetch homepage: ${res.status}`)
  }

  const json = await res.json()
  return json.data?.[0] || null
}

function blockToMdx(block: Block): string {
  const component = block.__component

  switch (component) {
    case 'blocks.paragraph':
      return block.content as string

    case 'blocks.cards-grid': {
      const cards = (block.cards as Array<{ title: string; description?: string; link?: string; linkText?: string }>) || []
      let mdx = ''
      if (block.heading) mdx += `## ${block.heading}\n\n`
      if (block.subheading) mdx += `${block.subheading}\n\n`
      mdx += '<div class="cards-grid">\n\n'
      for (const card of cards) {
        mdx += `### ${card.title}\n\n`
        if (card.description) mdx += `${card.description}\n\n`
        if (card.link) mdx += `[${card.linkText || 'Learn more'}](${card.link})\n\n`
      }
      mdx += '</div>\n'
      return mdx
    }

    case 'blocks.card-links-grid': {
      const cards = (block.cards as Array<{ title: string; description?: string; href: string }>) || []
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
      const items = (block.items as Array<{ quote: string; author?: string; role?: string; organization?: string }>) || []
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

function homepageToMdx(homepage: Homepage): string {
  const frontmatter: Record<string, unknown> = {
    slug: 'home',
    title: homepage.seo?.metaTitle || homepage.hero.title,
    heroTitle: homepage.hero.title,
    heroDescription: homepage.hero.description || ''
  }

  // Add hero CTAs to frontmatter
  if (homepage.hero.primaryCta || (homepage.hero.secondaryCtas && homepage.hero.secondaryCtas.length > 0)) {
    const ctas: CtaLink[] = []
    if (homepage.hero.primaryCta) {
      ctas.push({ ...homepage.hero.primaryCta, style: 'primary' })
    }
    if (homepage.hero.secondaryCtas) {
      ctas.push(...homepage.hero.secondaryCtas.map((cta) => ({ ...cta, style: 'secondary' })))
    }
    frontmatter.heroCtas = ctas
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
        if ((item as CtaLink).style) mdx += `    style: "${(item as CtaLink).style}"\n`
        if ((item as CtaLink).external) mdx += `    external: true\n`
      }
    } else {
      mdx += `${key}: ${JSON.stringify(value)}\n`
    }
  }
  mdx += '---\n\n'

  // Add content blocks
  if (homepage.content && homepage.content.length > 0) {
    for (const block of homepage.content) {
      mdx += blockToMdx(block)
      mdx += '\n'
    }
  }

  return mdx
}

async function main() {
  console.log('Fetching homepage from Strapi...')

  try {
    const homepage = await fetchHomepage()

    if (!homepage) {
      console.log('No homepage data to sync')
      return
    }

    const mdxContent = homepageToMdx(homepage)

    const outputPath = join(process.cwd(), 'src/content/pages/home.mdx')
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, mdxContent)

    console.log(`Homepage synced to ${outputPath}`)
  } catch (error) {
    console.error('Error syncing homepage:', error)
    process.exit(1)
  }
}

main()
