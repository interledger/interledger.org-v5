import type { SyncedImageSource } from '@/types/airtable'

// Value readers shared by the grant report and grantee profile parts of
// scripts/import-airtable.ts. Each reader returns undefined, or a short
// "expected ..." text, for a value it cannot use, so the caller can name the
// Airtable field in its error.

// The file types the site accepts. Airtable does not limit them, so the sync
// fails on any other type, for example HEIC from an iPhone or a PDF.
export const ALLOWED_IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]

// Airtable does not limit file size either. The sync makes every image small,
// but it refuses to download a file this large at all.
export const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024

const MAX_FILES_PER_IMAGE_FIELD = 1

export function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function nonBlankString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() === '' ? undefined : value.trim()
}

// The value as an error message shows it. Long text is never printed whole.
export function describeValue(value: unknown): string {
  if (value === undefined) return 'missing'
  if (Array.isArray(value)) return `${value.length} value(s)`
  return JSON.stringify(value)
}

// Reads the Airtable attachment object: { id, url, size, type, ... }.
function readAttachment(
  file: unknown,
  alt: string
): SyncedImageSource | { expected: string } {
  if (
    !isRecordLike(file) ||
    typeof file.id !== 'string' ||
    typeof file.url !== 'string' ||
    typeof file.size !== 'number'
  ) {
    return { expected: 'an attachment with an id, url and size' }
  }
  if (
    typeof file.type !== 'string' ||
    !ALLOWED_IMAGE_TYPES.includes(file.type)
  ) {
    return {
      expected: `a file of type ${ALLOWED_IMAGE_TYPES.join(', ')} (got ${String(file.type)})`
    }
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return {
      expected: `a file of at most ${MAX_SOURCE_IMAGE_BYTES / 1024 / 1024} MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB)`
    }
  }
  return { attachmentId: file.id, url: file.url, sizeBytes: file.size, alt }
}

// An image field is optional, but it holds at most one file, of an allowed
// type and size. The file itself is checked again after download.
export function readImageField(
  value: unknown,
  alt: string
): SyncedImageSource | undefined | { expected: string } {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > MAX_FILES_PER_IMAGE_FIELD) {
    return { expected: `at most ${MAX_FILES_PER_IMAGE_FIELD} file` }
  }
  const [file] = value
  if (file === undefined) return undefined
  return readAttachment(file, alt)
}
