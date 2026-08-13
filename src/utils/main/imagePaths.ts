export const TARGET_WIDTHS = [640, 1280, 1920, 2560, 3840] as const

/**
 * Width ladder offered by default in Netlify Image CDN mode. Body images and
 * avatars never render above ~1920 CSS px even at DPR 2, so advertising 2560 and
 * 3840 there would only add billed transforms of clamped, byte-identical output
 * and extra edge-cache entries. Sources that genuinely need 4K (the homepage
 * hero) pass `TARGET_WIDTHS` explicitly to opt back into the full ladder.
 */
export const DEFAULT_CDN_WIDTHS = [640, 1280, 1920] as const

/**
 * Width ladder for speaker avatars. Every rung is a separately billed transform
 * and a separate edge-cache entry, and Netlify clamps rather than upscales — so
 * for a source narrower than a rung, that rung returns the same pixels as the
 * one below it at full price. No Sessionize photo is wider than 400px and they
 * render at 200–400 CSS px, which makes all three default rungs collapse onto
 * the same output: 6 transforms per photo (two formats) where 4 will do.
 *
 * 240 is a genuine downscale for the card grids at DPR 1; 480 covers DPR 2 and
 * clamps to the source width for anything narrower.
 */
export const AVATAR_CDN_WIDTHS = [240, 480] as const

/**
 * Encoding quality, shared by the two things that can produce a variant: the
 * build-time encoder (`scripts/optimize-images.ts`) and the Netlify Image CDN
 * URL builder (`imageCdn.ts`). Defined here so the two cannot drift, and so a
 * change to either lands in the CI cache key (this file is hashed by
 * `.github/actions/cache-optimized-images`).
 *
 * Higher than sharp's WebP default (80): blog/body images were looking soft
 * when the browser had to fall back to a small variant (INTORG-934).
 */
export const WEBP_QUALITY = 90

/**
 * AVIF at q85 with 4:4:4 chroma stays visually close to WebP q90 while usually
 * smaller, with cleaner dark gradients (less banding than 4:2:0).
 */
export const AVIF_QUALITY = 85

/**
 * The only extensions we optimize. An allowlist, and the single source of truth
 * for everything that has to agree on the answer: the build-time encoder
 * (`scripts/optimize-images.ts`, which also builds the deployed-sources catalog
 * from it), `resolveOptimizableSource` in `images.ts`, and the build audit
 * (`audit-image-optimization.ts`).
 *
 * These must agree exactly. The encoder's list decides what lands in the
 * catalog; the resolver's list decides what is *expected* to be in it. While the
 * resolver was an `.svg`/`.gif` denylist instead, a deployed `.tiff` under
 * `/uploads/img/original` was absent from the catalog (the encoder skipped it)
 * yet still resolved as optimizable, so it rendered as a "missing from this
 * deploy" degrade despite shipping fine.
 *
 * GIF and SVG are excluded deliberately: transcoding a GIF (or applying a CDN
 * `fm=` transform) drops animation, and an SVG has nothing to gain. Both ship
 * as-is.
 */
const OPTIMIZABLE_RASTER_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif'
])

/**
 * Lowercased extension of a URL path or filesystem path, ignoring any `?query`
 * or `#fragment`. Hand-rolled rather than `path.extname` to keep this module
 * dependency-free — it is imported by the SSR bundle, the encoder script, and a
 * build integration alike.
 */
function extensionOf(pathOrUrlPath: string): string {
  const withoutSuffix = pathOrUrlPath.split(/[?#]/)[0]
  const lastSeparator = Math.max(
    withoutSuffix.lastIndexOf('/'),
    withoutSuffix.lastIndexOf('\\')
  )
  const lastDot = withoutSuffix.lastIndexOf('.')
  return lastDot > lastSeparator
    ? withoutSuffix.slice(lastDot).toLowerCase()
    : ''
}

/** Whether a path's extension is one the optimizer can produce variants for. */
export function hasOptimizableRasterExtension(pathOrUrlPath: string): boolean {
  return OPTIMIZABLE_RASTER_EXTENSIONS.has(extensionOf(pathOrUrlPath))
}

/**
 * Percent-encodes a literal source path for emission into a URL context.
 *
 * Image paths reach us in *literal* form — the catalogs are built from
 * `path.relative(PUBLIC_DIR, …)`, so a file named `hero image.avif` is stored
 * with a real space. That is the right shape for catalog lookups and for
 * `URLSearchParams`, but not for an HTML attribute, and a `srcset` is
 * unforgiving: entries are comma-separated and each is `<url> <descriptor>`, so
 * an unencoded space or comma silently redraws the entry boundaries.
 *
 * Encodes per segment rather than with `encodeURI`, which leaves `,`, `#` and
 * `?` untouched — all three corrupt a URL built from a filename that contains
 * them.
 *
 * Input must be literal, never already-encoded: re-encoding turns `%20` into
 * `%2520`. In particular this must not be applied to a Netlify Image CDN URL,
 * whose query values are already encoded (see `imageCdn.ts`).
 */
export function encodeImageUrlPath(pathname: string): string {
  return pathname.split('/').map(encodeURIComponent).join('/')
}

export const IMAGE_URL_PATHS = {
  publicSource: '/img',
  publicOptimized: '/img/optimized',
  uploadSource: '/uploads/img/original',
  uploadOptimized: '/img/optimized/uploads',
  /**
   * Speaker photos downloaded from Sessionize by `scripts/sync-sessionize.ts`.
   * They sit outside `/img`, so every prefix check has to name them explicitly
   * — the omission is why they were the one image family still shipping raw.
   *
   * Variants land under `publicOptimized` like every other source, which is
   * what makes them inherit the `/img/optimized` gitignore entry, the CI
   * encode cache, and the `/img/*` cache header without further wiring.
   */
  sessionizeSource: '/sessionize-speakers/img',
  sessionizeOptimized: '/img/optimized/sessionize-speakers'
} as const

/**
 * Written by `scripts/optimize-images.ts` (gitignored). Loaded in images.ts via
 * `import.meta.glob` when present so SSR never needs runtime fs against public/.
 * See INTORG-946 / docs/decisions/008-netlify-ssr-function-bundle-size.md.
 */
export const OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH =
  'src/generated/optimized-image-manifest.json' as const

/**
 * Optimizable source paths present in the deploy, written by
 * `scripts/optimize-images.ts` in CDN mode (gitignored). CDN mode skips the
 * encoder, so `getOptimizedImage()` has no per-image existence signal; this
 * catalog gates the CDN branch so a referenced-but-missing source degrades to a
 * plain `<img>` instead of a 404ing `<picture>` source. Covers both committed
 * `/img/**` assets (a renamed hero highres) and git-synced `/uploads/**`
 * originals (an upload not yet synced from the firewalled CMS).
 */
export const DEPLOYED_IMAGE_SOURCES_CATALOG_RELATIVE_PATH =
  'src/generated/deployed-image-sources-catalog.json' as const

export interface OptimizedImageManifest {
  version: 1
  variants: string[]
}

export interface DeployedImageSourcesCatalog {
  version: 1
  sources: string[]
}

export function pathToSegments(urlPath: string): string[] {
  return urlPath.split('/').filter(Boolean)
}
