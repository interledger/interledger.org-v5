import sharp, { type Metadata } from 'sharp'
import { tryCatchAsync } from '../shared/tryCatch'
import { MAX_IMAGE_BYTES } from '../shared/uploadLimits'
import { IMAGE_URL_PATHS } from './imagePaths'

// Image helpers for the grant report sync in scripts/import-airtable.ts.
// Grantees upload images with no limit on size, so the sync makes each one a
// small, clean source file before it is committed. The build then makes the
// responsive variants from it, like any other image under /img.

// The longest side of a stored image. To confirm against the report design
// (INTORG-1303): a report image is never wider than the content column.
export const MAX_REPORT_IMAGE_EDGE = 2400
// Higher than the build's WEBP_QUALITY, because this file is the source that
// the build encodes again.
const REPORT_IMAGE_QUALITY = 90
const REPORT_IMAGE_EXTENSION = '.webp'

// Folder under public/ for report images, one subfolder per report.
export const REPORT_IMAGES_DIR = `${IMAGE_URL_PATHS.publicSource}/grantee-reports`

// What sharp reports for the allowed types. AVIF is a HEIF container, so
// sharp says 'heif' for it, and HEIC (also HEIF, but HEVC) must stay out.
const ALLOWED_DECODED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const AVIF_COMPRESSION = 'av1'

export interface NormalizedImage {
  data: Buffer
  width: number
  height: number
}

// Site-relative path of a report image. The attachment ID does not change
// while the file stays the same, so a second sync finds the file it wrote.
export function reportImagePath(
  reportId: string,
  attachmentId: string
): string {
  return `${REPORT_IMAGES_DIR}/${reportId}/${attachmentId}${REPORT_IMAGE_EXTENSION}`
}

function isAllowedFormat(metadata: Metadata): boolean {
  if (metadata.format === 'heif')
    return metadata.compression === AVIF_COMPRESSION
  return (
    metadata.format !== undefined &&
    ALLOWED_DECODED_FORMATS.has(metadata.format)
  )
}

// Turns the image the correct way up, removes all metadata (phone photos can
// carry GPS location), limits the longest side and encodes WebP. Fails on a
// file that is not a readable image of an allowed type, whatever its name says.
export async function normalizeReportImage(
  input: Buffer
): Promise<NormalizedImage | Error> {
  const metadata = await tryCatchAsync(() => sharp(input).metadata())
  if (metadata instanceof Error) {
    return new Error(`cannot read the image (${metadata.message})`)
  }
  if (!isAllowedFormat(metadata)) {
    return new Error(`not a JPEG, PNG, WebP or AVIF image (${metadata.format})`)
  }
  // sharp writes no metadata unless asked to, so EXIF and GPS are dropped.
  const encoded = await tryCatchAsync(() =>
    sharp(input, { failOn: 'error' })
      .rotate()
      .resize({
        width: MAX_REPORT_IMAGE_EDGE,
        height: MAX_REPORT_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: REPORT_IMAGE_QUALITY })
      .toBuffer({ resolveWithObject: true })
  )
  if (encoded instanceof Error) {
    return new Error(`cannot read the image (${encoded.message})`)
  }
  const { data, info } = encoded
  if (data.length > MAX_IMAGE_BYTES) {
    return new Error(
      `still ${(data.length / 1024 / 1024).toFixed(1)} MB after resizing, over the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit`
    )
  }
  return { data, width: info.width, height: info.height }
}

// Files under REPORT_IMAGES_DIR that no Live report uses any more: the report
// left Live, or programs replaced or removed the image.
export function findOrphanImagePaths(
  existingPaths: string[],
  usedPaths: ReadonlySet<string>
): string[] {
  return existingPaths.filter((existing) => !usedPaths.has(existing))
}

// Width and height of an image the sync stored in an earlier run.
export async function readStoredImageSize(
  filePath: string
): Promise<{ width: number; height: number } | Error> {
  const metadata = await tryCatchAsync(() => sharp(filePath).metadata())
  if (metadata instanceof Error) {
    return new Error(`cannot read ${filePath} (${metadata.message})`)
  }
  const { width, height } = metadata
  if (width === undefined || height === undefined) {
    return new Error(`no dimensions in ${filePath}`)
  }
  return { width, height }
}
