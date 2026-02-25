/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Serializers and helpers used across page and summit-page.
 */

import fs from 'fs'
import matter from 'gray-matter'
import { marked } from 'marked'
import TurndownService from 'turndown'
import type { MediaFile } from '../../types/shared/types'

type MediaLike = Pick<MediaFile, 'url'> & { formats?: MediaFile['formats'] }

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*'
})

// ── Constants ────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'es']

// ── Utility functions ────────────────────────────────────────────────────────

/** Derive log label from Strapi UID: 'api::foundation-page.foundation-page' -> 'foundation-page' */
export function uidToLogLabel(uid: string): string {
  const parts = uid.split('.')
  return parts[parts.length - 1] ?? uid
}

/**
 * Gets the resolved URL for a Strapi media field.
 * Pass `preferredFormat` to try a specific image format first (e.g. 'thumbnail'),
 * falling back to the original URL if that format is unavailable.
 */
export function getImageUrl(
  media: MediaLike | undefined | null,
  preferredFormat?: 'thumbnail' | 'small' | 'medium' | 'large'
): string | undefined {
  if (!media?.url) return undefined

  function resolve(url: string): string {
    if (url.startsWith('/uploads/')) {
      const uploadsBase = process.env.STRAPI_UPLOADS_BASE_URL
      return uploadsBase ? `${uploadsBase.replace(/\/$/, '')}${url}` : url
    }
    return url
  }

  if (preferredFormat && media.formats?.[preferredFormat]?.url) {
    return resolve(media.formats[preferredFormat].url)
  }

  return resolve(media.url)
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return turndown.turndown(html.replace(/&nbsp;/gi, ' '))
}

// ── Text helpers ─────────────────────────────────────────────────────────────

export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''
  return marked.parse(markdown) as string
}

/**
 * Strips any surrounding straight or curly quotes from a blockquote string
 * and wraps the result in curly double quotes for consistent styling.
 */
export function formatBlockquote(quote: string): string {
  const stripped = quote
    .trim()
    .replace(
      /^["\u2018\u2019\u201c\u201d]+|["\u2018\u2019\u201c\u201d]+$/gu,
      ''
    )
    .trim()
  return `\u201C${stripped}\u201D`
}

/**
 * Strips HTML tags and markdown syntax, returning plain text.
 */
export function toPlainText(text: string): string {
  if (!text) return ''

  return (
    text
      // Remove markdown bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove markdown links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim()
  )
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

export function heroFrontmatter(
  hero:
    | {
        title?: string
        description?: string
        backgroundImage?: { url?: string }
      }
    | undefined
): Record<string, string> {
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

export function seoFrontmatter(
  seo:
    | {
        metaTitle?: string
        metaDescription?: string
        metaImage?: { url?: string }
        keywords?: string
        canonicalUrl?: string
      }
    | undefined
): Record<string, string> {
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
