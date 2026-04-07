/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Serializers and helpers used across page and summit-page.
 */

import fs from 'fs'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import { marked } from 'marked'
import TurndownService from 'turndown'
import type { MediaFile } from '../../types/shared/types'

type MediaLike = { url?: string; formats?: MediaFile['formats'] }

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*'
})

// Preserve <u> (underline) - Turndown strips unknown tags by default
turndown.addRule('underline', {
  filter: 'u',
  replacement: (content) => `<u>${content}</u>`
})

// ── Constants ────────────────────────────────────────────────────────────────

export const defaultLang = 'en'
export const LOCALES = [defaultLang, 'es']

// ── Utility functions ────────────────────────────────────────────────────────

/** Derive log label from Strapi UID: 'api::foundation-page.foundation-page' -> 'foundation-page' */
export function uidToLogLabel(uid: string): string {
  const parts = uid.split('.')
  return parts[parts.length - 1] ?? uid
}

/**
 * Options for gray-matter stringify to output single-quoted YAML strings.
 * Uses a custom YAML engine with js-yaml 4's forceQuotes (gray-matter's
 * bundled js-yaml 3.x does not support this option).
 */
const YAML_QUOTE_OPTS = { forceQuotes: true, quotingType: "'" as const }

export const MATTER_STRINGIFY_OPTIONS = {
  engines: {
    yaml: {
      parse: (input: string) => yaml.load(input) as Record<string, unknown>,
      stringify: (data: object) => yaml.dump(data, YAML_QUOTE_OPTS)
    }
  }
} as Record<string, unknown>

/**
 * Serializes a value as a YAML scalar: single-quoted string or 'null'.
 * Escapes internal single quotes per YAML spec ('').
 */
export function yamlSingleQuoteScalar(
  value: string | null | undefined
): string {
  if (value === null || value === undefined) return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

/**
 * Gets the resolved URL for a Strapi media field.
 *
 * For library images, `media.url` is the stable master path (`/uploads/img/original/...`).
 * Pass `preferredFormat` only when you explicitly want a derivative under `img/optimized/`
 * (e.g. admin previews); prefer the default for MDX export so sync/re-import keeps working.
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

/**
 * Strip the Strapi host from any `/uploads/` URL in a content string.
 *
 * CKEditor (running inside the Strapi admin) inserts absolute image URLs like
 * `http://localhost:1337/uploads/img/original/foo.png`. This normalizes them
 * to root-relative paths (`/uploads/img/original/foo.png`) so the exported
 * MDX works consistently across dev, staging, and production environments.
 */
export function normalizeUploadsUrls(content: string): string {
  return content.replace(/https?:\/\/[^/\s"']+\/uploads\//g, '/uploads/')
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
        metaDescription?: string
      }
    | undefined
): Record<string, string> {
  const data: Record<string, string> = {}
  if (!seo || !seo.metaDescription) return data
  data.metaDescription = seo.metaDescription
  return data
}
