/**
 * Lifecycle callbacks for summit-page
 * Generates MDX files for summit pages with locale support
 * - English pages go to src/content/summit/
 * - Localized pages go to src/content/{locale}/summit/
 * Then commits and pushes to trigger Netlify preview builds
 */

import fs from 'fs'
import path from 'path'
import { gitCommitAndPush } from '../../../../utils/gitSync'

interface MediaFile {
  id: number
  url: string
  alternativeText?: string
  name?: string
}

interface CtaLink {
  id: number
  text: string
  url: string
  style?: string
}

interface Hero {
  id: number
  title: string
  description?: string
  backgroundImage?: MediaFile
  secondaryCtas?: CtaLink[]
}

interface Seo {
  id: number
  metaTitle: string
  metaDescription?: string
  metaImage?: MediaFile
  keywords?: string
  canonicalUrl?: string
}

interface Card {
  id: number
  title: string
  description?: string
  link?: string
  linkText?: string
  icon?: string
  openInNewTab?: boolean
}

interface CardsGrid {
  __component: 'blocks.cards-grid'
  id: number
  heading?: string
  subheading?: string
  cards?: Card[]
  columns?: '2' | '3' | '4'
}

interface CardLink {
  id: number
  title: string
  description?: string
  url: string
  icon?: string
}

interface CardLinksGrid {
  __component: 'blocks.card-links-grid'
  id: number
  heading?: string
  links?: CardLink[]
}

interface CarouselItem {
  id: number
  title: string
  description?: string
  image?: MediaFile
  link?: string
}

interface Carousel {
  __component: 'blocks.carousel'
  id: number
  heading?: string
  items?: CarouselItem[]
}

interface CtaBanner {
  __component: 'blocks.cta-banner'
  id: number
  title: string
  description?: string
  ctaText?: string
  ctaUrl?: string
  backgroundColor?: string
}

interface Paragraph {
  __component: 'blocks.paragraph'
  id: number
  content: string
  alignment?: 'left' | 'center' | 'right'
}

interface ImageRow {
  __component: 'blocks.image-row'
  id: number
  images?: MediaFile[]
}

type ContentBlock = CardsGrid | CardLinksGrid | Carousel | CtaBanner | Paragraph | ImageRow

interface SummitPage {
  id: number
  documentId: string
  title: string
  slug: string
  gradient?: string
  locale?: string
  hero?: Hero
  seo?: Seo
  content?: ContentBlock[]
  publishedAt?: string
}

interface Event {
  result?: SummitPage
}

function escapeQuotes(value: string): string {
  if (!value) return ''
  return value.replace(/"/g, '\\"')
}

function getImageUrl(media: MediaFile | undefined): string | undefined {
  if (!media?.url) return undefined

  if (media.url.startsWith('/uploads/')) {
    const uploadsBase = process.env.STRAPI_UPLOADS_BASE_URL
    return uploadsBase
      ? `${uploadsBase.replace(/\/$/, '')}${media.url}`
      : media.url
  }

  return media.url
}

function htmlToMarkdown(html: string): string {
  if (!html) return ''

  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([\s\S]*?)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function serializeCardsGrid(block: CardsGrid): string {
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

function serializeCardLinksGrid(block: CardLinksGrid): string {
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

function serializeCarousel(block: Carousel): string {
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

function serializeCtaBanner(block: CtaBanner): string {
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

function serializeParagraph(block: Paragraph): string {
  const content = htmlToMarkdown(block.content)
  if (block.alignment && block.alignment !== 'left') {
    return `<div class="text-${block.alignment}">\n\n${content}\n\n</div>`
  }
  return content
}

function serializeImageRow(block: ImageRow): string {
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

function serializeContent(content: ContentBlock[] | undefined): string {
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

function generateMDX(page: SummitPage): string {
  const locale = page.locale || 'en'
  const isLocalized = locale !== 'en'

  const frontmatterLines: string[] = [
    `slug: "${escapeQuotes(page.slug)}"`,
    `title: "${escapeQuotes(page.title)}"`
  ]

  if (page.gradient) {
    frontmatterLines.push(`gradient: "${escapeQuotes(page.gradient)}"`)
  }

  // Add hero fields
  if (page.hero) {
    if (page.hero.title) {
      frontmatterLines.push(`heroTitle: "${escapeQuotes(page.hero.title)}"`)
    }
    if (page.hero.description) {
      frontmatterLines.push(`heroDescription: "${escapeQuotes(page.hero.description)}"`)
    }
    const heroImage = getImageUrl(page.hero.backgroundImage)
    if (heroImage) {
      frontmatterLines.push(`heroImage: "${escapeQuotes(heroImage)}"`)
    }
  }

  // Add SEO fields
  if (page.seo) {
    if (page.seo.metaTitle) {
      frontmatterLines.push(`metaTitle: "${escapeQuotes(page.seo.metaTitle)}"`)
    }
    if (page.seo.metaDescription) {
      frontmatterLines.push(`metaDescription: "${escapeQuotes(page.seo.metaDescription)}"`)
    }
    const metaImage = getImageUrl(page.seo.metaImage)
    if (metaImage) {
      frontmatterLines.push(`metaImage: "${escapeQuotes(metaImage)}"`)
    }
    if (page.seo.keywords) {
      frontmatterLines.push(`keywords: "${escapeQuotes(page.seo.keywords)}"`)
    }
    if (page.seo.canonicalUrl) {
      frontmatterLines.push(`canonicalUrl: "${escapeQuotes(page.seo.canonicalUrl)}"`)
    }
  }

  // Add locale and contentId for localized pages
  if (isLocalized) {
    frontmatterLines.push(`locale: "${locale}"`)
    frontmatterLines.push(`contentId: "${page.documentId}"`)
  }

  const frontmatter = frontmatterLines.join('\n')
  const content = serializeContent(page.content)

  return `---\n${frontmatter}\n---\n\n${content}\n`
}

/**
 * Gets the output directory for a summit page based on locale
 * - English: src/content/summit/
 * - Other locales: src/content/{locale}/summit/
 */
function getOutputDir(locale: string): string {
  const projectRoot = path.resolve(__dirname, '../../../../../../..')

  if (locale === 'en') {
    return path.join(projectRoot, 'src/content/summit')
  }

  return path.join(projectRoot, 'src/content', locale, 'summit')
}

async function writeMDXFile(page: SummitPage): Promise<string> {
  const locale = page.locale || 'en'
  const outputDir = getOutputDir(locale)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filename = `${page.slug}.mdx`
  const filepath = path.join(outputDir, filename)
  const mdxContent = generateMDX(page)

  fs.writeFileSync(filepath, mdxContent, 'utf-8')
  console.log(`✅ Generated Summit Page MDX file: ${filepath}`)

  return filepath
}

/**
 * Fetches the published version of a summit page with all components populated.
 * Strapi v5 document service defaults to 'draft' status,
 * so we must explicitly request 'published'.
 */
async function fetchFullPage(documentId: string, locale: string): Promise<SummitPage | null> {
  try {
    const page = await strapi.documents('api::summit-page.summit-page').findOne({
      documentId,
      locale,
      status: 'published',
      populate: {
        hero: {
          populate: '*'
        },
        seo: {
          populate: '*'
        },
        content: {
          populate: '*'
        }
      }
    })
    return page as SummitPage | null
  } catch (error) {
    console.error(`Failed to fetch summit page ${documentId}:`, error)
    return null
  }
}

/**
 * All locales to export MDX for.
 * When any locale is saved, all locales are re-exported.
 */
const LOCALES = ['en', 'es']

async function exportAllLocales(documentId: string): Promise<string[]> {
  const filepaths: string[] = []

  for (const locale of LOCALES) {
    try {
      const page = await fetchFullPage(documentId, locale)
      if (!page) {
        console.log(`⏭️  No published ${locale} summit page for ${documentId}`)
        continue
      }
      const filepath = await writeMDXFile(page)
      filepaths.push(filepath)
    } catch (error) {
      console.error(`⚠️  Failed to export ${locale} summit page for ${documentId}:`, error)
    }
  }

  return filepaths
}

export default {
  async afterCreate(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`📝 Creating summit page MDX for all locales: ${result.slug}`)
    const filepaths = await exportAllLocales(result.documentId)

    if (filepaths.length > 0) {
      await gitCommitAndPush(filepaths, `summit: add "${result.title}"`)
    }
  },

  async afterUpdate(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`📝 Updating summit page MDX for all locales: ${result.slug}`)
    const filepaths = await exportAllLocales(result.documentId)

    // Clean up MDX for any locale that is no longer published
    const deletedPaths: string[] = []
    for (const locale of LOCALES) {
      const outputDir = getOutputDir(locale)
      const filepath = path.join(outputDir, `${result.slug}.mdx`)
      if (!filepaths.includes(filepath) && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        console.log(`🗑️  Deleted unpublished ${locale} summit MDX: ${filepath}`)
        deletedPaths.push(filepath)
      }
    }

    const allPaths = [...filepaths, ...deletedPaths]
    if (allPaths.length > 0) {
      await gitCommitAndPush(allPaths, `summit: update "${result.title}"`)
    }
  },

  async afterDelete(event: Event) {
    const { result } = event
    if (!result) return

    console.log(`🗑️  Deleting summit page MDX for all locales: ${result.slug}`)

    const deletedPaths: string[] = []
    for (const locale of LOCALES) {
      const outputDir = getOutputDir(locale)
      const filepath = path.join(outputDir, `${result.slug}.mdx`)

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        console.log(`🗑️  Deleted ${locale} summit MDX: ${filepath}`)
        deletedPaths.push(filepath)
      }
    }

    if (deletedPaths.length > 0) {
      await gitCommitAndPush(deletedPaths, `summit: delete "${result.title}"`)
    }
  }
}
