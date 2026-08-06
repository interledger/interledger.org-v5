import { AVIF_QUALITY, TARGET_WIDTHS, WEBP_QUALITY } from './imagePaths'

/**
 * Netlify Image CDN — on-demand image transformation at the edge.
 *
 * When enabled, `getOptimizedImage()` returns URLs pointing here instead of at
 * files produced by `scripts/optimize-images.ts`, and the build skips the
 * encode step entirely. The two are mutually exclusive by design: a build
 * either pre-generates variants or defers to the CDN, never both.
 *
 * Netlify never upscales — requesting a width larger than the source returns
 * the source size — so a srcset can offer every target width without knowing
 * the source's intrinsic width. That is what makes skipping the encoder
 * possible: the intrinsic width is the one thing only the encoder knew.
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
 * Whether this build should emit Netlify Image CDN URLs.
 *
 * `IMAGE_CDN` is an explicit override — `on` or `off` — and wins over
 * everything. CI sets `IMAGE_CDN=on` so its builds match what Netlify ships
 * without paying for an encode nobody looks at.
 *
 * Otherwise it auto-detects Netlify, which sets `NETLIFY` in every build and in
 * `netlify dev`. Local `astro dev` and `astro build` get neither, so they keep
 * using pre-generated variants — `/.netlify/images` does not exist off-platform
 * and would 404 every image.
 */
export function isImageCdnEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const override = env.IMAGE_CDN?.trim().toLowerCase()
  if (override === 'on') return true
  if (override === 'off') return false
  return isSet(env.NETLIFY)
}

export interface ImageCdnUrlOptions {
  format: ImageCdnFormat
  width: number
}

/**
 * Builds a transformation URL for a site-relative source path. Parameters
 * follow Netlify's Image CDN API: `url` (source), `fm` (format), `w` (width),
 * `q` (quality).
 *
 * A width is always sent. An unsized URL returns the source dimensions, which
 * is byte-identical to the largest width for any source narrower than it — a
 * second billed transform for the same image.
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

/** Widest target width — what a caller needing a single URL should request. */
export function largestTargetWidth(
  widths: readonly number[] = TARGET_WIDTHS
): number {
  return Math.max(...widths)
}
