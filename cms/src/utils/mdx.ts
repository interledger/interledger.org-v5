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
