/**
 * Maximum allowed image upload size (2 MB). Keep in sync with the image half of
 * cms/src/utils/uploadLimits.ts (that file also carries a CMS-only ceiling for
 * non-image media).
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export const MAX_IMAGE_SIZE_LABEL = '2 MB'

export function isImageOverSizeLimit(bytes: number): boolean {
  return bytes > MAX_IMAGE_BYTES
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

export function imageOverSizeLimitError(fileLabel: string): string {
  return `"${fileLabel}" is over the ${MAX_IMAGE_SIZE_LABEL} limit for images. ${IMAGE_SIZE_REMEDY}`
}
