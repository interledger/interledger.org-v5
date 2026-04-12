/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Serializers and helpers used across page and summit-page.
 */

import fs from 'fs'
import yaml from 'js-yaml'
import matter from 'gray-matter'
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
  return `'${String(value).replace(/\r\n/g, '\n').replace(/'/g, "''")}'`
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

export interface HeroCta {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
  analytics_event_label?: string
}

interface HeroData {
  title?: string
  description?: string
  backgroundImage?: { url?: string }
  hero_call_to_action?: HeroCta[]
}

export function heroFrontmatter(
  hero: HeroData | undefined
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
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
  const ctas = hero.hero_call_to_action?.filter((c) => c.text && c.link)
  if (ctas && ctas.length > 0) {
    data.heroCtas = ctas.map((c) => ({
      text: c.text!,
      link: c.link!,
      ...(c.style && c.style !== 'primary' ? { style: c.style } : {}),
      ...(c.external ? { external: true } : {}),
      ...(c.analytics_event_label
        ? { analytics_event_label: c.analytics_event_label }
        : {})
    }))
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
