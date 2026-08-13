import path from 'path'

/**
 * Upload ceilings. Media uploaded through the admin is git-committed into the
 * site repo (INTORG-876), so both limits are deliberately tight.
 *
 * The image half of this module is mirrored in src/utils/shared/uploadLimits.ts
 * for the Astro side; the media half is CMS-only, since only Strapi accepts
 * non-image uploads.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export const MAX_IMAGE_SIZE_LABEL = '2 MB'

/** Ceiling for non-image media (video, PDF). Mirrored in cms/config/plugins.ts. */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024

export const MAX_MEDIA_SIZE_LABEL = '5 MB'

/**
 * Image subset of seedable media (see SEED_MIME_BY_EXT in seedMedia.ts) —
 * the source of truth for "is this an image" so the 2 MB limit is never
 * applied to non-image media (PDFs, video).
 */
export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.tiff'
])

export function isImagePath(urlPath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.posix.extname(urlPath).toLowerCase())
}

export function isImageOverSizeLimit(bytes: number): boolean {
  return bytes > MAX_IMAGE_BYTES
}

export function isMediaOverSizeLimit(bytes: number): boolean {
  return bytes > MAX_MEDIA_BYTES
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** What an editor should do about an oversized image, in one sentence. */
const IMAGE_SIZE_REMEDY =
  'Resize or compress it, or save it as WebP or AVIF, then upload again.'

export function imageSizeLimitError(fileLabel: string, bytes: number): string {
  return `"${fileLabel}" is ${formatFileSize(bytes)}, over the ${MAX_IMAGE_SIZE_LABEL} limit for images. ${IMAGE_SIZE_REMEDY}`
}

/**
 * Variant for the streaming upload path, which aborts as soon as the limit is
 * passed and so never learns the real file size.
 */
export function imageOverSizeLimitError(fileLabel: string): string {
  return `"${fileLabel}" is over the ${MAX_IMAGE_SIZE_LABEL} limit for images. ${IMAGE_SIZE_REMEDY}`
}

export function mediaSizeLimitError(fileLabel: string, bytes: number): string {
  return `"${fileLabel}" is ${formatFileSize(bytes)}, over the ${MAX_MEDIA_SIZE_LABEL} limit for videos and documents. For a longer video, upload it to YouTube and paste the link instead.`
}
