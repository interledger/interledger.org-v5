/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Types, serializers, and helpers used across page, summit-page, and blog-post.
 */

import fs from 'fs'
import matter from 'gray-matter'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

// ── Types ────────────────────────────────────────────────────────────────────

export interface MediaFile {
  id: number
  url: string
  alternativeText?: string
  name?: string
  width?: number
  height?: number
  formats?: {
    thumbnail?: { url: string }
    small?: { url: string }
    medium?: { url: string }
    large?: { url: string }
  }
}

export interface CtaLink {
  id: number
  text: string
  url: string
  style?: string
}

export interface Hero {
  id: number
  title: string
  description?: string
  backgroundImage?: MediaFile
  secondaryCtas?: CtaLink[]
}

export interface Seo {
  id: number
  metaTitle: string
  metaDescription?: string
  metaImage?: MediaFile
  keywords?: string
  canonicalUrl?: string
}

export interface Card {
  id: number
  title: string
  description?: string
  link?: string
  linkText?: string
  icon?: string
  openInNewTab?: boolean
}

export interface CardsGrid {
  __component: 'blocks.cards-grid'
  id: number
  heading?: string
  subheading?: string
  cards?: Card[]
  columns?: '2' | '3' | '4'
}

export interface CardLink {
  id: number
  title: string
  description?: string
  url: string
  icon?: string
}

export interface CardLinksGrid {
  __component: 'blocks.card-links-grid'
  id: number
  heading?: string
  links?: CardLink[]
}

export interface CarouselItem {
  id: number
  title: string
  description?: string
  image?: MediaFile
  link?: string
}

export interface Carousel {
  __component: 'blocks.carousel'
  id: number
  heading?: string
  items?: CarouselItem[]
}

export interface CtaBanner {
  __component: 'blocks.cta-banner'
  id: number
  title: string
  description?: string
  ctaText?: string
  ctaUrl?: string
  backgroundColor?: string
}

export interface Paragraph {
  __component: 'blocks.paragraph'
  id: number
  content: string
  alignment?: 'left' | 'center' | 'right'
}

export interface ImageRow {
  __component: 'blocks.image-row'
  id: number
  images?: MediaFile[]
}

export type ContentBlock = CardsGrid | CardLinksGrid | Carousel | CtaBanner | Paragraph | ImageRow

// ── Constants ────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'es']

// ── Utility functions ────────────────────────────────────────────────────────

function escapeQuotes(value: string): string {
  if (!value) return ''
  return value.replace(/"/g, '\\"')
}

export function getImageUrl(media: MediaFile | undefined): string | undefined {
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

export function serializeCardsGrid(block: CardsGrid): string {
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

export function serializeCardLinksGrid(block: CardLinksGrid): string {
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

export function serializeCarousel(block: Carousel): string {
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

export function serializeCtaBanner(block: CtaBanner): string {
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

export function serializeParagraph(block: Paragraph): string {
  const content = htmlToMarkdown(block.content)
  if (block.alignment && block.alignment !== 'left') {
    return `<div class="text-${block.alignment}">\n\n${content}\n\n</div>`
  }
  return content
}

export function serializeImageRow(block: ImageRow): string {
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

export function serializeContent(content: ContentBlock[] | undefined): string {
  if (!content || content.length === 0) return ''

  const blocks: string[] = []

  for (const block of content) {
    switch (block.__component) {
      case 'blocks.cards-grid':
        blocks.push(serializeCardsGrid(block as CardsGrid))
        break
      case 'blocks.card-links-grid':
        blocks.push(serializeCardLinksGrid(block as CardLinksGrid))
        break
      case 'blocks.carousel':
        blocks.push(serializeCarousel(block as Carousel))
        break
      case 'blocks.cta-banner':
        blocks.push(serializeCtaBanner(block as CtaBanner))
        break
      case 'blocks.paragraph':
        blocks.push(serializeParagraph(block as Paragraph))
        break
      case 'blocks.image-row':
        blocks.push(serializeImageRow(block as ImageRow))
        break
      default:
        console.warn(`Unknown block component: ${(block as any).__component}`)
    }
  }

  return blocks.join('\n\n')
}

// ── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Read existing frontmatter fields that should be preserved (not managed by Strapi).
 * Used during MDX export to keep fields like 'localizes' that are set manually in MDX.
 */
export function getPreservedFields(filepath: string): Record<string, string> {
  const preserved: Record<string, string> = {}
  const fieldsToPreserve = ['localizes'] // Fields set in MDX but not in Strapi

  if (!fs.existsSync(filepath)) {
    return preserved
  }

  try {
    const fileContent = fs.readFileSync(filepath, 'utf-8')
    const { data } = matter(fileContent)

    for (const key of fieldsToPreserve) {
      if (data[key] !== undefined) {
        preserved[key] = String(data[key])
      }
    }
  } catch {
    // Ignore read errors
  }

  return preserved
}

export function heroFrontmatter(hero: Hero | undefined): Record<string, string> {
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

export function seoFrontmatter(seo: Seo | undefined): Record<string, string> {
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
