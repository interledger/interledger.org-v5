import { AVIF_QUALITY, TARGET_WIDTHS, WEBP_QUALITY } from './imagePaths'

/**
 * Netlify Image CDN — on-demand image transformation at the edge.
 *
 * When enabled, `getOptimizedImage()` returns URLs pointing here instead of at
 * files produced by `scripts/image-optimiser/`, and the build skips the encode
 * step entirely. The two paths are mutually exclusive by design: one build
 * either pre-generates variants or defers to the CDN, never both.
 *
 * Netlify never upscales — requesting a width larger than the source returns
 * the source size — so a srcset can offer every target width without knowing
 * the source's intrinsic width, which is exactly what makes dropping the
 * build-time encoder possible.
 */
export const NETLIFY_IMAGE_ENDPOINT = '/.netlify/images'

export type ImageCdnFormat = 'webp' | 'avif'

const QUALITY_BY_FORMAT: Record<ImageCdnFormat, number> = {
  webp: WEBP_QUALITY,
  avif: AVIF_QUALITY
}

/** Values that read as "explicitly off" rather than "set". */
const FALSEY = new Set(['', '0', 'false', 'no', 'off'])

function isSet(value: string | undefined): boolean {
  return value !== undefined && !FALSEY.has(value.trim().toLowerCase())
}

/**
 * True inside a Netlify build or function, where `/.netlify/images` exists.
 *
 * `NETLIFY` is set by every Netlify build and by `netlify dev`; local builds
 * and GitHub Actions keep the pre-generated variants. `IMAGE_CDN=off` is an
 * escape hatch so the CDN can be turned off from the Netlify UI without a
 * revert — set it per-context there if a deploy needs the old behaviour.
 */
export function isImageCdnEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!isSet(env.NETLIFY)) return false
  return env.IMAGE_CDN?.trim().toLowerCase() !== 'off'
}

export interface ImageCdnUrlOptions {
  format: ImageCdnFormat
  width: number
}

/**
 * Builds a transformation URL for a site-relative source path.
 *
 * Parameters follow Netlify's Image CDN API: `url` (source), `w` (width),
 * `fm` (output format), `q` (quality).
 *
 * Width is always sent. An unsized URL would return the source dimensions —
 * byte-identical to the largest width for any source narrower than it, and so
 * a second billed transform for the same image (the CDN-side equivalent of the
 * `-full` duplication removed from the build-time encoder).
 */
export function buildImageCdnUrl(
  sourcePath: string,
  { format, width }: ImageCdnUrlOptions
): string {
  const query = new URLSearchParams({
    url: sourcePath,
    fm: format,
    w: String(width),
    q: String(QUALITY_BY_FORMAT[format])
  })
  return `${NETLIFY_IMAGE_ENDPOINT}?${query}`
}

export interface ImageCdnVariant {
  src: string
  width: number
}

/** One transformation URL per target width, ascending. */
export function buildImageCdnVariants(
  sourcePath: string,
  format: ImageCdnFormat,
  widths: readonly number[] = TARGET_WIDTHS
): ImageCdnVariant[] {
  return widths.map((width) => ({
    src: buildImageCdnUrl(sourcePath, { format, width }),
    width
  }))
}
