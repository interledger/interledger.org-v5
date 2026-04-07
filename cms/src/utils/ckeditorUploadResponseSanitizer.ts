import path from 'path'
import { originalMasterPublicUrlFromStorageName } from './imageLayoutPaths'

/** Strip Strapi hash suffix from basename (same idea as upload lifecycle). */
function cleanedStorageName(strapiName: string): string {
  const ext = path.extname(strapiName) || '.bin'
  const base = path.basename(strapiName, ext)
  const cleanedBase = base.replace(/_[a-f0-9]{10}$/i, '')
  return `${cleanedBase}${ext}`
}

/**
 * Rewrite `/uploads/img/optimized/...` URLs in nested request bodies to stable
 * `/uploads/img/original/...` so saved content matches media library URLs.
 */
export function deepNormalizeUploadsUrls(body: unknown): void {
  if (body === null || body === undefined) return
  if (typeof body === 'string') return
  if (Array.isArray(body)) {
    for (let i = 0; i < body.length; i++) {
      const v = body[i]
      if (typeof v === 'string') {
        body[i] = normalizeOptimizedUrlsInString(v)
      } else if (v && typeof v === 'object') {
        deepNormalizeUploadsUrls(v)
      }
    }
    return
  }
  if (typeof body === 'object') {
    const o = body as Record<string, unknown>
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (typeof v === 'string') {
        o[k] = normalizeOptimizedUrlsInString(v)
      } else if (v && typeof v === 'object') {
        deepNormalizeUploadsUrls(v)
      }
    }
  }
}

function normalizeOptimizedUrlsInString(s: string): string {
  const re = /\/uploads\/img\/optimized\/([^/?#'"\s<>]+)/g
  return s.replace(re, (_match, filename: string) =>
    originalMasterPublicUrlFromStorageName(cleanedStorageName(filename))
  )
}

/**
 * Sanitizes Strapi upload API responses before they reach CKEditor.
 *
 * 1. Strips the host from absolute `url` fields so CKEditor inserts root-relative
 *    paths (`/uploads/...`) instead of `http://localhost:1337/uploads/...`. This
 *    keeps the stored content portable across environments.
 *
 * 2. CKEditor builds `srcset` from `formats[].width` + `formats[].url`. Our main
 *    `url` is under `img/original/` while derivatives live under `img/optimized/`.
 *    If `formats[].url` incorrectly points at `.../original/thumbnail_*` etc., the
 *    browser prefers `srcset` → 404 → broken in-editor preview. When that mismatch
 *    is detected, drop `formats` so the adapter sends `{ default: mainUrl }` only.
 */
const DERIVATIVE_UNDER_ORIGINAL =
  /\/img\/original\/(thumbnail|small|medium|large|xlarge)_/i

function toRelativeUploadsUrl(url: string): string {
  if (!url.startsWith('http')) return url
  // Strip scheme + host, keep path from /uploads/ onward
  return url.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/, '')
}

/**
 * Recursively walk a request body object and normalize any absolute Strapi
 * upload URL found in a string value to a root-relative path.
 *
 * CKEditor constructs `http://localhost:1337/uploads/...` in the browser before
 * the content is sent to the server. Normalizing on write ensures the DB always
 * stores root-relative paths, regardless of which host the admin was accessed from.
 */
export function deepNormalizeUploadsUrls(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) deepNormalizeUploadsUrls(item)
    return
  }
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (typeof value === 'string') {
      record[key] = value.replace(
        /https?:\/\/[^/\s"']+\/uploads\//g,
        '/uploads/'
      )
    } else {
      deepNormalizeUploadsUrls(value)
    }
  }
}

export function sanitizeStrapiImageUploadResponseForCke(body: unknown): void {
  if (!Array.isArray(body) || body.length === 0) return

  for (const item of body) {
    if (!item || typeof item !== 'object') continue
    const file = item as Record<string, unknown>
    const mime = typeof file.mime === 'string' ? file.mime : ''
    const url = typeof file.url === 'string' ? file.url : ''
    if (!mime.startsWith('image/')) continue
    if (!url.includes('/uploads/')) continue

    // Normalize main URL to root-relative
    file.url = toRelativeUploadsUrl(url)

    if (!url.includes('/img/original/')) continue
    const formats = file.formats
    if (!formats || typeof formats !== 'object') continue

    const hasBadDerivativeUrl = Object.keys(formats as object).some((key) => {
      const fmt = (formats as Record<string, { url?: string }>)[key]
      const u = typeof fmt?.url === 'string' ? fmt.url : ''
      return u.length > 0 && DERIVATIVE_UNDER_ORIGINAL.test(u)
    })

    if (hasBadDerivativeUrl) {
      delete file.formats
    }
  }
}
