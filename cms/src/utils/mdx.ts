/**
 * Shared content utilities for Strapi lifecycle hooks.
 * Helpers used across CMS lifecycle files.
 */

import type { MediaFile } from '../../types/shared/types'

// ── Media helpers ────────────────────────────────────────────────────────────

/**
 * Optional base URL for Strapi upload paths.
 * Only needed when uploads are hosted externally (CDN, S3, etc.).
 * When unset, upload paths remain relative (/uploads/...), which works
 * for the default git-based deployment where uploads are committed to the repo.
 */
const UPLOADS_BASE_URL = process.env.STRAPI_UPLOADS_BASE_URL

/**
 * Gets the resolved URL for a Strapi media field.
 * Pass `preferredFormat` to try a specific image format first (e.g. 'thumbnail'),
 * falling back to the original URL if that format is unavailable.
 */
export function getImageUrl(
  media: MediaFile | undefined | null,
  preferredFormat?: 'thumbnail' | 'small' | 'medium' | 'large'
): string | undefined {
  if (!media?.url) return undefined

  function resolve(url: string): string {
    if (url.startsWith('/uploads/')) {
      return UPLOADS_BASE_URL
        ? `${UPLOADS_BASE_URL.replace(/\/$/, '')}${url}`
        : url
    }
    return url
  }

  if (preferredFormat && media.formats?.[preferredFormat]?.url) {
    return resolve(media.formats[preferredFormat].url)
  }

  return resolve(media.url)
}

// ── Text helpers ─────────────────────────────────────────────────────────────

/**
 * Converts markdown to HTML.
 * Handles: bold, italic, links, line breaks.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''

  return (
    markdown
      // Bold: **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      // Wrap in paragraph if not already
      .replace(/^(?!<p>)/, '<p>')
      .replace(/(?!<\/p>)$/, '</p>')
  )
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
