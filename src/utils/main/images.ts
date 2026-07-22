import path from 'node:path'
import stubManifest from '../../generated/optimized-image-manifest.stub.json'
import {
  IMAGE_URL_PATHS,
  TARGET_WIDTHS,
  type OptimizedImageManifest
} from './imagePaths'

export {
  IMAGE_URL_PATHS,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH,
  TARGET_WIDTHS,
  pathToSegments,
  type OptimizedImageManifest
} from './imagePaths'

export interface ImageVariant {
  src: string
  width: number
}

export interface OptimizedImage {
  variants: ImageVariant[]
  fullSrc: string | null
  avifVariants: ImageVariant[]
  avifFullSrc: string | null
}

const generatedManifestModules = import.meta.glob(
  '../../generated/optimized-image-manifest.json',
  { eager: true, import: 'default' }
) as Record<string, OptimizedImageManifest>

const bundledManifest: OptimizedImageManifest =
  Object.values(generatedManifestModules)[0] ??
  (stubManifest as OptimizedImageManifest)

const bundledCatalogPaths = new Set(
  bundledManifest.variants.map((src) => (src.startsWith('/') ? src : `/${src}`))
)

/** Test-only override. Pass `null` to restore the bundled/stub catalog. */
let catalogOverride: ReadonlySet<string> | null = null

export function setOptimizedImageVariantCatalogForTests(
  paths: Iterable<string> | null
): void {
  catalogOverride = paths === null ? null : new Set(paths)
}

function optimizedVariantExists(urlPath: string): boolean {
  return (catalogOverride ?? bundledCatalogPaths).has(urlPath)
}

export function buildImageSrcset(variants: ImageVariant[]): string {
  return variants.map((v) => `${v.src} ${v.width}w`).join(', ')
}

export function hasOptimizedVariants(image: OptimizedImage): boolean {
  return image.variants.length > 0 || image.fullSrc !== null
}

function isWithinUrlPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

function replaceUrlPathPrefix(
  pathname: string,
  fromPath: string,
  toPath: string
): string {
  return `${toPath}${pathname.slice(fromPath.length)}`
}

/**
 * Maps an original image URL to its optimized WebP base path.
 * Handles relative paths (/img/..., /uploads/img/original/...) and
 * absolute Strapi URLs (http://host/uploads/...).
 * Returns null for SVGs or unrecognized paths.
 */
function getOptimizedBase(src: string): string | null {
  if (!src || src.endsWith('.svg')) return null

  let pathname = src
  if (src.startsWith('http')) {
    try {
      pathname = new URL(src).pathname
    } catch {
      return null
    }
  }

  const ext = path.extname(pathname)
  if (!ext) return null
  const stem = pathname.slice(0, -ext.length)

  if (isWithinUrlPath(pathname, IMAGE_URL_PATHS.uploadSource)) {
    return replaceUrlPathPrefix(
      stem,
      IMAGE_URL_PATHS.uploadSource,
      IMAGE_URL_PATHS.uploadOptimized
    )
  }

  if (
    isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicSource) &&
    !isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicOptimized)
  ) {
    return replaceUrlPathPrefix(
      stem,
      IMAGE_URL_PATHS.publicSource,
      IMAGE_URL_PATHS.publicOptimized
    )
  }

  return null
}

/**
 * Returns available optimized WebP/AVIF data for an image from the build-time
 * variants catalog (see `scripts/optimize-images.ts`).
 *
 * No runtime filesystem access — safe inside the Netlify SSR Lambda even when
 * `public/img` and `public/uploads` are excluded from the function bundle
 * (INTORG-946 / ADR-008).
 *
 * Returns responsive `variants` (sized at target widths) plus a `fullSrc`
 * WebP at the original dimensions. For images smaller than the smallest
 * target width, only `fullSrc` will be populated.
 */
export function getOptimizedImage(src: string): OptimizedImage {
  const base = getOptimizedBase(src)
  if (!base) {
    return { variants: [], fullSrc: null, avifVariants: [], avifFullSrc: null }
  }

  const variants = TARGET_WIDTHS.filter((w) =>
    optimizedVariantExists(`${base}-${w}.webp`)
  ).map((w) => ({ src: `${base}-${w}.webp`, width: w }))

  const avifVariants = TARGET_WIDTHS.filter((w) =>
    optimizedVariantExists(`${base}-${w}.avif`)
  ).map((w) => ({ src: `${base}-${w}.avif`, width: w }))

  const fullWebP = `${base}-full.webp`
  const fullAvif = `${base}-full.avif`

  return {
    variants,
    fullSrc: optimizedVariantExists(fullWebP) ? fullWebP : null,
    avifVariants,
    avifFullSrc: optimizedVariantExists(fullAvif) ? fullAvif : null
  }
}
