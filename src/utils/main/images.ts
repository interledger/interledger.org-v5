import path from 'node:path'
import stubManifest from '../../generated/optimized-image-manifest.stub.json'
import {
  buildImageCdnUrl,
  buildImageCdnVariants,
  imageCdnEnabled,
  largestTargetWidth
} from './imageCdn'
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

export interface OptimizedImage {
  variants: ImageVariant[]
  fullSrc: string | null
  avifVariants: ImageVariant[]
  avifFullSrc: string | null
}

interface ResolvedImageSource {
  /** Pathname used by the pre-generated catalog path mapping. */
  pathname: string
  /** Source URL/path used by Netlify Image CDN transforms. */
  cdnSource: string
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

/** Test-only override. Pass `null` to fall back to the environment. */
let imageCdnOverride: boolean | null = null

export function setImageCdnEnabledForTests(enabled: boolean | null): void {
  imageCdnOverride = enabled
}

/**
 * Every variant the CDN can produce, without consulting a catalog: Netlify
 * clamps each width to the source size, so offering all target widths is safe
 * even though the intrinsic width is unknown here.
 *
 * `fullSrc` points at the largest target width rather than an unsized URL.
 * Both render the same pixels for any source narrower than 3840, but an unsized
 * URL is a distinct cache entry and so a second billed transform.
 */
function buildCdnImage(source: string): OptimizedImage {
  const fullWidth = largestTargetWidth()
  return {
    variants: buildImageCdnVariants(source, 'webp'),
    fullSrc: buildImageCdnUrl(source, { format: 'webp', width: fullWidth }),
    avifVariants: buildImageCdnVariants(source, 'avif'),
    avifFullSrc: buildImageCdnUrl(source, { format: 'avif', width: fullWidth })
  }
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
 * Resolves an image reference to the source data we are allowed to optimize,
 * or `null` when it isn't one.
 *
 * Handles relative paths (/img/..., /uploads/img/original/...) and absolute
 * Strapi URLs (http://host/uploads/...). Rejects SVGs, extensionless paths,
 * anything outside the known source directories, and the generated output tree.
 *
 * Split out from `getOptimizedBase` because the CDN and pre-generated paths
 * need different source forms:
 * - catalog mapping always uses a site-relative `pathname`
 * - CDN keeps absolute upload URLs as-is to avoid assuming same-origin uploads
 */
function resolveOptimizableSource(src: string): ResolvedImageSource | null {
  if (!src || src.endsWith('.svg')) return null

  let pathname = src
  let absoluteSource: string | null = null
  if (src.startsWith('http')) {
    try {
      const parsed = new URL(src)
      pathname = parsed.pathname
      absoluteSource = src
    } catch {
      return null
    }
  }

  if (!path.extname(pathname)) return null

  if (isWithinUrlPath(pathname, IMAGE_URL_PATHS.uploadSource)) {
    return {
      pathname,
      cdnSource: absoluteSource ?? pathname
    }
  }

  if (
    isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicSource) &&
    !isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicOptimized)
  ) {
    return {
      pathname,
      cdnSource: pathname
    }
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
 * Returns responsive `variants` (target widths plus any exact intrinsic-width
 * file) plus a `fullSrc` WebP at the original dimensions. For images with no
 * numbered variants, only `fullSrc` will be populated.
 *
 * On Netlify (and in CI) this returns Netlify Image CDN URLs for optimizable
 * sources. Absolute upload URLs stay absolute in CDN mode so transforms do not
 * depend on same-origin `/uploads/**` files being present in the current deploy.
 *
 * CDN URLs already contain percent-encoded query parameter values, so callers
 * must treat them as final URLs: do not run `encodeURI()` or a similar
 * whole-URL escaping pass over the returned strings, or `%2F...` becomes
 * `%252F...` and the CDN source path breaks. See `imageCdn.ts`.
 */
export function getOptimizedImage(src: string): OptimizedImage {
  const source = resolveOptimizableSource(src)
  if (!source) {
    return { variants: [], fullSrc: null, avifVariants: [], avifFullSrc: null }
  }

  if (imageCdnOverride ?? imageCdnEnabled()) {
    return buildCdnImage(source.cdnSource)
  }

  const base = getOptimizedBase(source.pathname)
  const variants = listSizedVariants(base, 'webp')
  const avifVariants = listSizedVariants(base, 'avif')

  const fullWebP = `${base}-full.webp`
  const fullAvif = `${base}-full.avif`

  return {
    variants,
    fullSrc: optimizedVariantExists(fullWebP) ? fullWebP : null,
    avifVariants,
    avifFullSrc: optimizedVariantExists(fullAvif) ? fullAvif : null
  }
}
