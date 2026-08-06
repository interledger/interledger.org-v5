import path from 'node:path'
import stubManifest from '../../generated/optimized-image-manifest.stub.json'
import { buildImageCdnVariants, isImageCdnEnabled } from './imageCdn'
import { IMAGE_URL_PATHS, type OptimizedImageManifest } from './imagePaths'

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

/**
 * Available variants for one source image, per format, ascending by width.
 *
 * There is no separate full-size field: the largest entry in each list is the
 * full-size one. A dedicated `-full` output used to exist and was byte-identical
 * to the largest numbered variant for every source — see `planVariants()`.
 * Use {@link getLargestVariant} where a single URL is needed.
 */
export interface OptimizedImage {
  variants: ImageVariant[]
  avifVariants: ImageVariant[]
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

/** Test-only override. Pass `null` to fall back to the environment. */
let imageCdnOverride: boolean | null = null

export function setImageCdnEnabledForTests(enabled: boolean | null): void {
  imageCdnOverride = enabled
}

/**
 * Every variant the CDN can produce, without consulting a catalog: Netlify
 * clamps each width to the source size, so offering all target widths is safe
 * even though the intrinsic width is unknown here.
 */
function buildCdnImage(source: string): OptimizedImage {
  return {
    variants: buildImageCdnVariants(source, 'webp'),
    avifVariants: buildImageCdnVariants(source, 'avif')
  }
}

export function setOptimizedImageVariantCatalogForTests(
  paths: Iterable<string> | null
): void {
  catalogOverride = paths === null ? null : new Set(paths)
}

export function buildImageSrcset(variants: ImageVariant[]): string {
  return variants.map((v) => `${v.src} ${v.width}w`).join(', ')
}

export function hasOptimizedVariants(image: OptimizedImage): boolean {
  return image.variants.length > 0
}

/**
 * Widest variant in a list, or `null` when empty. Variants are ascending, so
 * this is the last one — the full-size render of the source.
 *
 * For a single-URL context (a CSS `background-image`, a `<link rel=preload>`)
 * where a srcset can't be used.
 */
export function getLargestVariant(
  variants: ImageVariant[]
): ImageVariant | null {
  return variants.at(-1) ?? null
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
 * Resolves an image reference to a site-relative source path we are allowed to
 * optimize, or `null` when it isn't one.
 *
 * Handles relative paths (/img/..., /uploads/img/original/...) and absolute
 * Strapi URLs (http://host/uploads/...). Rejects SVGs, extensionless paths,
 * anything outside the known source directories, and the generated output tree
 * itself.
 */
function resolveOptimizableSource(src: string): string | null {
  if (!src || src.endsWith('.svg')) return null

  let pathname = src
  if (src.startsWith('http')) {
    try {
      pathname = new URL(src).pathname
    } catch {
      return null
    }
  }

  if (!path.extname(pathname)) return null

  if (isWithinUrlPath(pathname, IMAGE_URL_PATHS.uploadSource)) return pathname

  if (
    isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicSource) &&
    !isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicOptimized)
  ) {
    return pathname
  }

  return null
}

/** Maps a resolved source path to the base name of its pre-generated variants. */
function getOptimizedBase(pathname: string): string {
  const stem = pathname.slice(0, -path.extname(pathname).length)

  return isWithinUrlPath(pathname, IMAGE_URL_PATHS.uploadSource)
    ? replaceUrlPathPrefix(
        stem,
        IMAGE_URL_PATHS.uploadSource,
        IMAGE_URL_PATHS.uploadOptimized
      )
    : replaceUrlPathPrefix(
        stem,
        IMAGE_URL_PATHS.publicSource,
        IMAGE_URL_PATHS.publicOptimized
      )
}

/**
 * Lists numbered width variants (`{base}-{width}.{ext}`) from the build-time
 * catalog. Includes both fixed `TARGET_WIDTHS` and exact original widths
 * emitted by the optimize script (INTORG-934).
 */
function listSizedVariants(base: string, ext: 'webp' | 'avif'): ImageVariant[] {
  const catalog = catalogOverride ?? bundledCatalogPaths
  const prefix = `${base}-`
  const suffix = `.${ext}`
  const variants: ImageVariant[] = []

  for (const urlPath of catalog) {
    if (!urlPath.startsWith(prefix) || !urlPath.endsWith(suffix)) continue
    const mid = urlPath.slice(prefix.length, -suffix.length)
    if (!/^\d+$/.test(mid)) continue
    variants.push({ src: urlPath, width: Number(mid) })
  }

  return variants.sort((a, b) => a.width - b.width)
}

/**
 * Returns available optimized WebP/AVIF data for an image from the build-time
 * variants catalog (see `scripts/optimize-images.ts`).
 *
 * No runtime filesystem access — safe inside the Netlify SSR Lambda even when
 * `public/img` and `public/uploads` are excluded from the function bundle
 * (INTORG-946 / ADR-008).
 *
 * Returns responsive `variants` per format — the target widths the source can
 * fill, plus its exact intrinsic width (INTORG-934). Empty lists mean the image
 * isn't ours to optimize (SVG, GIF, an unknown path) and callers should fall
 * back to the raw source.
 */
export function getOptimizedImage(src: string): OptimizedImage {
  const source = resolveOptimizableSource(src)
  if (!source) return { variants: [], avifVariants: [] }

  if (imageCdnOverride ?? isImageCdnEnabled()) {
    return buildCdnImage(source)
  }

  const base = getOptimizedBase(source)
  return {
    variants: listSizedVariants(base, 'webp'),
    avifVariants: listSizedVariants(base, 'avif')
  }
}
