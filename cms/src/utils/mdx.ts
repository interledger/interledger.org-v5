/**
 * Shared MDX utilities for Strapi lifecycle hooks.
 * Serializers and helpers used across page and summit-page.
 */

import fs from 'fs'
import prettier from 'prettier'
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

/**
 * Returns the slug to use as the MDX filename for a given locale.
 * Non-default locales use the English slug so filenames stay locale-independent
 * (e.g. es/about-us.mdx, not es/sobre-nosotros.mdx).
 */
export function resolveFilenameSlug(
  locale: string,
  ownSlug: string,
  englishSlug?: string | null
): string {
  return locale !== defaultLang && englishSlug ? englishSlug : ownSlug
}

/**
 * Converts a pathSlug to a flat MDX filename stem (no extension).
 * Slashes become hyphens so storage stays flat regardless of URL depth.
 */
export function pathSlugToMdxFilename(pathSlug: string): string {
  return pathSlug.replace(/^\/+|\/+$/g, '').replace(/\//g, '-')
}

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
 * Serializes a multi-line string as a YAML literal block scalar (`|`), keyed by
 * `key` at `keyIndent` spaces. Every content line is indented two spaces deeper
 * so blank lines survive as real paragraph breaks (`\n\n`)
 */
export function yamlLiteralBlockScalar(
  key: string,
  value: string | null | undefined,
  keyIndent: number
): string | null {
  if (!value) return null
  const contentIndent = ' '.repeat(keyIndent + 2)
  const body = String(value)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line ? `${contentIndent}${line}` : line))
    .join('\n')
  return `${' '.repeat(keyIndent)}${key}: |\n${body}`
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
}

interface HeroData {
  title?: string
  description?: string
  backgroundImage?: { url?: string; alternativeText?: string }
  backgroundImageMobile?: { url?: string; alternativeText?: string }
  hero_call_to_action?: HeroCta | null
}

export function heroFrontmatter(
  hero: HeroData | undefined
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (!hero) return data
  if (!hero.title?.trim()) throw new Error('Hero is missing required title')
  data.heroTitle = hero.title
  if (hero.description) {
    data.heroDescription = hero.description
  }
  const heroImage = getImageUrl(hero.backgroundImage)
  if (heroImage) {
    data.heroImage = heroImage
    data.heroImageAlt = hero.backgroundImage?.alternativeText ?? ''
  }
  const heroImageMobile = getImageUrl(hero.backgroundImageMobile)
  if (heroImageMobile) {
    data.heroImageMobile = heroImageMobile
    data.heroImageMobileAlt = hero.backgroundImageMobile?.alternativeText ?? ''
  }
  const cta = hero.hero_call_to_action
  if (cta) {
    if (!cta.text) throw new Error('Hero CTA is missing required text')
    if (!cta.link) throw new Error('Hero CTA is missing required link')
    data.heroCtas = [{
      text: cta.text!,
      link: cta.link!,
      ...(cta.style && cta.style !== 'primary' ? { style: cta.style } : {}),
      ...(cta.external ? { external: true } : {})
    }]
  }
  return data
}

const PRETTIER_MDX_OPTIONS: prettier.Options = {
  parser: 'mdx',
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  proseWrap: 'preserve'
}

/**
 * Matches a `code={\`...\`}` JSX attribute as produced by the CodeBlock
 * serializer. `(?:\\.|[^\`\\])*` walks escaped chars (\\, \`, \${) as single
 * units so an escaped backtick never closes the match early.
 */
const CODE_BLOCK_ATTR_RE = /code=\{`(?:\\.|[^`\\])*`\}/g

/**
 * Formats MDX content with Prettier using the project's code style.
 * Returns the original content unchanged if formatting fails.
 *
 * Prettier's MDX parser treats `code={\`...\`}` as a live JS expression and
 * re-indents the template literal's contents as JavaScript source, which
 * destroys the verbatim formatting of embedded CodeBlock samples. Those
 * attributes are swapped for placeholders before formatting and restored
 * verbatim afterward.
 */
export async function formatMdx(content: string): Promise<string> {
  const codeBlockAttrs: string[] = []
  const protectedContent = content.replace(CODE_BLOCK_ATTR_RE, (match) => {
    const index = codeBlockAttrs.push(match) - 1
    return `code={__CODE_BLOCK_ATTR_${index}__}`
  })

  try {
    const formatted = await prettier.format(
      protectedContent,
      PRETTIER_MDX_OPTIONS
    )
    return formatted.replace(
      /code=\{__CODE_BLOCK_ATTR_(\d+)__\}/g,
      (_match, index) => codeBlockAttrs[Number(index)]!
    )
  } catch (error) {
    console.warn('prettier formatting failed, writing unformatted MDX:', error)
    return content
  }
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
