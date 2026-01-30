/**
 * Import Homepage MDX to Strapi
 *
 * Usage: npx tsx scripts/import-homepage.ts
 *
 * Requires STRAPI_URL and STRAPI_PREVIEW_TOKEN environment variables
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'

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

interface HomepageFrontmatter {
  slug: string
  title: string
  heroTitle: string
  heroDescription?: string
  heroCtas?: CtaLink[]
}

interface StrapiBlock {
  __component: string
  [key: string]: unknown
}

function parseCardsFromMarkdown(content: string): Array<{ title: string; description?: string; link?: string; linkText?: string }> {
  const cards: Array<{ title: string; description?: string; link?: string; linkText?: string }> = []

  // Split by ### headings
  const cardSections = content.split(/(?=###\s)/)

  for (const section of cardSections) {
    const trimmed = section.trim()
    if (!trimmed || !trimmed.startsWith('###')) continue

    // Extract title from ### heading
    const titleMatch = trimmed.match(/^###\s+(.+)/)
    if (!titleMatch) continue

    const title = titleMatch[1].trim()

    // Get rest of content after title
    const rest = trimmed.replace(/^###\s+.+\n?/, '').trim()

    // Extract link if present
    const linkMatch = rest.match(/\[(.+?)\]\((.+?)\)/)
    const link = linkMatch ? linkMatch[2] : undefined
    const linkText = linkMatch ? linkMatch[1] : undefined

    // Description is everything except the link
    const description = rest.replace(/\[.+?\]\(.+?\)/, '').trim() || undefined

    cards.push({ title, description, link, linkText })
  }

  return cards
}

function parseCardLinksFromMarkdown(content: string): Array<{ title: string; description?: string; href: string }> {
  const cards: Array<{ title: string; description?: string; href: string }> = []

  // Match markdown links: - [Title](url) or - [Title](url) - description
  const linkMatches = content.matchAll(/[-*]\s*\[(.+?)\]\((.+?)\)(?:\s*[-–]\s*(.+))?/g)

  for (const match of linkMatches) {
    cards.push({
      title: match[1],
      href: match[2],
      description: match[3]?.trim()
    })
  }

  return cards
}

function parseContentToBlocks(content: string): StrapiBlock[] {
  const blocks: StrapiBlock[] = []

  // Match div blocks and plain text separately
  const divPattern = /<div class=["'](cards-grid|card-links|cta-banner|carousel)["']>([\s\S]*?)<\/div>/g
  let lastIndex = 0
  let match

  while ((match = divPattern.exec(content)) !== null) {
    // Add any text before this div as paragraph
    const beforeText = content.slice(lastIndex, match.index).trim()
    if (beforeText) {
      blocks.push({
        __component: 'blocks.paragraph',
        content: beforeText
      })
    }

    const divType = match[1]
    const innerContent = match[2].trim()

    switch (divType) {
      case 'cards-grid': {
        const cards = parseCardsFromMarkdown(innerContent)
        // Extract section heading (## before the cards)
        const headingMatch = innerContent.match(/^##\s+(.+)/)
        const heading = headingMatch ? headingMatch[1] : undefined

        blocks.push({
          __component: 'blocks.cards-grid',
          heading,
          cards
        })
        break
      }

      case 'card-links': {
        const cards = parseCardLinksFromMarkdown(innerContent)
        const headingMatch = innerContent.match(/^##\s+(.+)/)
        const heading = headingMatch ? headingMatch[1] : undefined

        blocks.push({
          __component: 'blocks.card-links-grid',
          heading,
          cards
        })
        break
      }

      case 'cta-banner': {
        const headingMatch = innerContent.match(/##\s+(.+)/)
        const heading = headingMatch ? headingMatch[1] : ''
        const textContent = innerContent
          .replace(/##\s+.+\n?/, '')
          .replace(/\[.+\]\(.+\)/g, '')
          .trim()

        const buttonMatches = [...innerContent.matchAll(/\[(.+?)\]\((.+?)\)/g)]

        blocks.push({
          __component: 'blocks.cta-banner',
          heading,
          text: textContent || undefined,
          primaryButtonText: buttonMatches[0]?.[1],
          primaryButtonLink: buttonMatches[0]?.[2],
          secondaryButtonText: buttonMatches[1]?.[1],
          secondaryButtonLink: buttonMatches[1]?.[2]
        })
        break
      }

      case 'carousel': {
        // Parse blockquotes as carousel items
        const items: Array<{ quote: string; author?: string; role?: string; organization?: string }> = []
        const quoteBlocks = innerContent.split(/\n\n+/)

        for (const block of quoteBlocks) {
          if (block.startsWith('>')) {
            const lines = block.split('\n').map(l => l.replace(/^>\s*/, ''))
            const quote = lines[0] || ''
            const attribution = lines[1]?.replace(/^—\s*/, '')

            if (attribution) {
              const [author, ...rest] = attribution.split(',')
              items.push({
                quote,
                author: author?.trim(),
                role: rest[0]?.trim(),
                organization: rest[1]?.trim()
              })
            } else {
              items.push({ quote })
            }
          }
        }

        const headingMatch = innerContent.match(/^##\s+(.+)/)
        blocks.push({
          __component: 'blocks.carousel',
          heading: headingMatch?.[1],
          items
        })
        break
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after last div
  const afterText = content.slice(lastIndex).trim()
  if (afterText) {
    blocks.push({
      __component: 'blocks.paragraph',
      content: afterText
    })
  }

  return blocks
}

function buildStrapiPayload(frontmatter: HomepageFrontmatter, content: string) {
  const payload: Record<string, unknown> = {
    seo: {
      metaTitle: frontmatter.title
    },
    hero: {
      title: frontmatter.heroTitle,
      description: frontmatter.heroDescription || ''
    }
  }

  // Add hero CTAs
  if (frontmatter.heroCtas && frontmatter.heroCtas.length > 0) {
    const primaryCta = frontmatter.heroCtas.find(cta => cta.style === 'primary')
    const secondaryCtas = frontmatter.heroCtas.filter(cta => cta.style !== 'primary')

    if (primaryCta) {
      payload.hero = {
        ...(payload.hero as object),
        primaryCta: {
          text: primaryCta.text,
          link: primaryCta.link,
          external: primaryCta.external || false
        }
      }
    }

    if (secondaryCtas.length > 0) {
      payload.hero = {
        ...(payload.hero as object),
        secondaryCtas: secondaryCtas.map(cta => ({
          text: cta.text,
          link: cta.link,
          external: cta.external || false
        }))
      }
    }
  }

  // Parse content into blocks
  const blocks = parseContentToBlocks(content)
  if (blocks.length > 0) {
    payload.content = blocks
  }

  return payload
}

async function importHomepage(payload: Record<string, unknown>) {
  const baseUrl = process.env.STRAPI_URL || 'http://localhost:1337'
  const token = process.env.STRAPI_PREVIEW_TOKEN

  if (!token) {
    throw new Error('STRAPI_PREVIEW_TOKEN is required')
  }

  const url = `${baseUrl}/api/homepage`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ data: payload })
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to import homepage: ${res.status} - ${error}`)
  }

  return res.json()
}

async function main() {
  const mdxPath = join(process.cwd(), 'src/content/pages/home.mdx')

  if (!existsSync(mdxPath)) {
    console.error(`MDX file not found: ${mdxPath}`)
    process.exit(1)
  }

  console.log('Reading homepage MDX...')
  const fileContent = readFileSync(mdxPath, 'utf-8')

  const { data: frontmatter, content } = matter(fileContent) as {
    data: HomepageFrontmatter
    content: string
  }

  console.log('Building Strapi payload...')
  const payload = buildStrapiPayload(frontmatter, content)

  console.log('Importing to Strapi...')
  try {
    await importHomepage(payload)
    console.log('Homepage imported successfully!')
  } catch (error) {
    console.error('Error importing homepage:', error)
    process.exit(1)
  }
}

main()
