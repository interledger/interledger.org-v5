/** Maximum allowed image upload size (2 MB). Keep in sync with src/utils/shared/uploadLimits.ts */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export const MAX_IMAGE_SIZE_LABEL = '2 MB'

export function isImageOverSizeLimit(bytes: number): boolean {
  return bytes > MAX_IMAGE_BYTES
}

export function formatImageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function imageSizeLimitError(fileLabel: string, bytes: number): string {
  return `Image "${fileLabel}" is ${formatImageSize(bytes)} — maximum allowed size is ${MAX_IMAGE_SIZE_LABEL}.`
}
