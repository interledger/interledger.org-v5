/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Serializers and helpers used across page, summit-page, and blog-post.
 */

import fs from 'fs'
import matter from 'gray-matter'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
})

// ── Constants ────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'es']

// ── Utility functions ────────────────────────────────────────────────────────

function escapeQuotes(value: string): string {
  if (!value) return ''
  return value.replace(/"/g, '\\"')
}

export function getImageUrl(media: { url?: string } | undefined): string | undefined {
  if (!media?.url) return undefined

  if (media.url.startsWith('/uploads/')) {
    const uploadsBase = process.env.STRAPI_UPLOADS_BASE_URL
    return uploadsBase
      ? `${uploadsBase.replace(/\/$/, '')}${media.url}`
      : media.url
  }

  return media.url
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return turndown.turndown(html.replace(/&nbsp;/gi, ' '))
}

// ── Block serializers ────────────────────────────────────────────────────────

export function serializeCardsGrid(block: {
  heading?: string
  subheading?: string
  columns?: string
  cards?: Array<{
    title: string
    description?: string
    link?: string
    linkText?: string
    icon?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }
  if (block.subheading) {
    lines.push(block.subheading)
    lines.push('')
  }

  lines.push(`<CardsGrid columns={${block.columns || 3}}>`)

  if (block.cards) {
    for (const card of block.cards) {
      lines.push('')
      lines.push(`<Card title="${escapeQuotes(card.title)}"${card.link ? ` link="${escapeQuotes(card.link)}"` : ''}${card.linkText ? ` linkText="${escapeQuotes(card.linkText)}"` : ''}${card.icon ? ` icon="${escapeQuotes(card.icon)}"` : ''}>`)
      if (card.description) {
        lines.push(card.description)
      }
      lines.push('</Card>')
    }
  }

  lines.push('')
  lines.push('</CardsGrid>')
  return lines.join('\n')
}

export function serializeCardLinksGrid(block: {
  heading?: string
  links?: Array<{
    title: string
    description?: string
    url: string
    icon?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }

  lines.push('<CardLinksGrid>')

  if (block.links) {
    for (const link of block.links) {
      lines.push('')
      lines.push(`<CardLink title="${escapeQuotes(link.title)}" url="${escapeQuotes(link.url)}"${link.icon ? ` icon="${escapeQuotes(link.icon)}"` : ''}>`)
      if (link.description) {
        lines.push(link.description)
      }
      lines.push('</CardLink>')
    }
  }

  lines.push('')
  lines.push('</CardLinksGrid>')
  return lines.join('\n')
}

export function serializeCarousel(block: {
  heading?: string
  items?: Array<{
    title: string
    description?: string
    image?: { url?: string }
    link?: string
  }>
}): string {
  const lines: string[] = []

  if (block.heading) {
    lines.push(`## ${block.heading}`)
    lines.push('')
  }

  lines.push('<Carousel>')

  if (block.items) {
    for (const item of block.items) {
      const imageUrl = getImageUrl(item.image)
      lines.push('')
      lines.push(`<CarouselItem title="${escapeQuotes(item.title)}"${imageUrl ? ` image="${escapeQuotes(imageUrl)}"` : ''}${item.link ? ` link="${escapeQuotes(item.link)}"` : ''}>`)
      if (item.description) {
        lines.push(item.description)
      }
      lines.push('</CarouselItem>')
    }
  }

  lines.push('')
  lines.push('</Carousel>')
  return lines.join('\n')
}

export function serializeCtaBanner(block: {
  title: string
  description?: string
  ctaText?: string
  ctaUrl?: string
  backgroundColor?: string
}): string {
  const lines: string[] = []

  const attrs = [
    `title="${escapeQuotes(block.title)}"`,
    block.ctaText ? `ctaText="${escapeQuotes(block.ctaText)}"` : null,
    block.ctaUrl ? `ctaUrl="${escapeQuotes(block.ctaUrl)}"` : null,
    block.backgroundColor ? `backgroundColor="${escapeQuotes(block.backgroundColor)}"` : null
  ].filter(Boolean).join(' ')

  lines.push(`<CtaBanner ${attrs}>`)
  if (block.description) {
    lines.push(block.description)
  }
  lines.push('</CtaBanner>')
  return lines.join('\n')
}

export function serializeParagraph(block: {
  content: string
  alignment?: string
}): string {
  const content = htmlToMarkdown(block.content)
  if (block.alignment && block.alignment !== 'left') {
    return `<div class="text-${block.alignment}">\n\n${content}\n\n</div>`
  }
  return content
}

export function serializeImageRow(block: {
  images?: Array<{ url?: string; alternativeText?: string }>
}): string {
  const lines: string[] = []
  lines.push('<ImageRow>')

  if (block.images) {
    for (const image of block.images) {
      const url = getImageUrl(image)
      if (url) {
        lines.push(`  ![${image.alternativeText || ''}](${url})`)
      }
    }
  }

  lines.push('</ImageRow>')
  return lines.join('\n')
}

export function serializeContent(content: Array<{ __component: string; [key: string]: unknown }> | undefined): string {
  if (!content || content.length === 0) return ''

  const blocks: string[] = []

  for (const block of content) {
    switch (block.__component) {
      case 'blocks.cards-grid':
        blocks.push(serializeCardsGrid(block as unknown as Parameters<typeof serializeCardsGrid>[0]))
        break
      case 'blocks.card-links-grid':
        blocks.push(serializeCardLinksGrid(block as unknown as Parameters<typeof serializeCardLinksGrid>[0]))
        break
      case 'blocks.carousel':
        blocks.push(serializeCarousel(block as unknown as Parameters<typeof serializeCarousel>[0]))
        break
      case 'blocks.cta-banner':
        blocks.push(serializeCtaBanner(block as unknown as Parameters<typeof serializeCtaBanner>[0]))
        break
      case 'blocks.paragraph':
        blocks.push(serializeParagraph(block as unknown as Parameters<typeof serializeParagraph>[0]))
        break
      case 'blocks.image-row':
        blocks.push(serializeImageRow(block as unknown as Parameters<typeof serializeImageRow>[0]))
        break
      default:
        console.warn(`Unknown block component: ${block.__component}`)
    }
  }

  return blocks.join('\n\n')
}

// ── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Read all existing frontmatter fields from an MDX file.
 * Strapi-managed fields will overwrite these when generating MDX.
 */
export function getPreservedFields(filepath: string): Record<string, unknown> {
  if (!fs.existsSync(filepath)) {
    return {}
  }

  try {
    const fileContent = fs.readFileSync(filepath, 'utf-8')
    const { data } = matter(fileContent)
    return data
  } catch {
    return {}
  }
}

export function heroFrontmatter(hero: {
  title?: string
  description?: string
  backgroundImage?: { url?: string }
} | undefined): Record<string, string> {
  const data: Record<string, string> = {}
  if (!hero) return data
  if (hero.title) {
    data.heroTitle = hero.title
  }
  if (hero.description) {
    data.heroDescription = hero.description
  }
  const heroImage = getImageUrl(hero.backgroundImage)
  if (heroImage) {
    data.heroImage = heroImage
  }
  return data
}

export function seoFrontmatter(seo: {
  metaTitle?: string
  metaDescription?: string
  metaImage?: { url?: string }
  keywords?: string
  canonicalUrl?: string
} | undefined): Record<string, string> {
  const data: Record<string, string> = {}
  if (!seo) return data
  if (seo.metaTitle) {
    data.metaTitle = seo.metaTitle
  }
  if (seo.metaDescription) {
    data.metaDescription = seo.metaDescription
  }
  const metaImage = getImageUrl(seo.metaImage)
  if (metaImage) {
    data.metaImage = metaImage
  }
  if (seo.keywords) {
    data.keywords = seo.keywords
  }
  if (seo.canonicalUrl) {
    data.canonicalUrl = seo.canonicalUrl
  }
  return data
}
