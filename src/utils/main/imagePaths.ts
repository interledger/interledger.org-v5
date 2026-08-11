export const TARGET_WIDTHS = [640, 1280, 1920, 2560, 3840] as const

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

export const IMAGE_URL_PATHS = {
  publicSource: '/img',
  publicOptimized: '/img/optimized',
  uploadSource: '/uploads/img/original',
  uploadOptimized: '/img/optimized/uploads'
} as const

/**
 * Written by `scripts/optimize-images.ts` (gitignored). Loaded in images.ts via
 * `import.meta.glob` when present so SSR never needs runtime fs against public/.
 * See INTORG-946 / docs/decisions/008-netlify-ssr-function-bundle-size.md.
 */
export const OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH =
  'src/generated/optimized-image-manifest.json' as const

/**
 * Committed upload source paths present in the deploy, written by
 * `scripts/optimize-images.ts` in CDN mode (gitignored). CDN mode skips the
 * encoder, so `getOptimizedImage()` has no per-image existence signal; this
 * catalog gates the CDN branch for `/uploads/**` so a path missing from the
 * deploy (an upload not yet git-synced from the firewalled CMS) degrades to a
 * plain `<img>` instead of a 404ing `<picture>` source.
 */
export const DEPLOYED_UPLOADS_CATALOG_RELATIVE_PATH =
  'src/generated/deployed-uploads-catalog.json' as const

export interface OptimizedImageManifest {
  version: 1
  variants: string[]
}

export interface DeployedUploadsCatalog {
  version: 1
  uploads: string[]
}

export function pathToSegments(urlPath: string): string[] {
  return urlPath.split('/').filter(Boolean)
}
