import path from 'node:path'
import stubManifest from '../../generated/optimized-image-manifest.stub.json'
import stubImageSourcesCatalog from '../../generated/deployed-image-sources-catalog.stub.json'
import {
  buildImageCdnUrl,
  buildImageCdnVariants,
  imageCdnEnabled,
  largestTargetWidth
} from './imageCdn'
import {
  DEFAULT_CDN_WIDTHS,
  IMAGE_URL_PATHS,
  type DeployedImageSourcesCatalog,
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

interface ResolvedImageSource {
  /** Site-relative pathname, used for both the catalog mapping and CDN source. */
  pathname: string
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

const generatedImageSourcesCatalogModules = import.meta.glob(
  '../../generated/deployed-image-sources-catalog.json',
  { eager: true, import: 'default' }
) as Record<string, DeployedImageSourcesCatalog>

const bundledImageSourcesCatalog: DeployedImageSourcesCatalog =
  Object.values(generatedImageSourcesCatalogModules)[0] ??
  (stubImageSourcesCatalog as DeployedImageSourcesCatalog)

const bundledDeployedSources = new Set(
  bundledImageSourcesCatalog.sources.map((src) =>
    src.startsWith('/') ? src : `/${src}`
  )
)

/** Test-only override. Pass `null` to restore the bundled/stub catalog. */
let catalogOverride: ReadonlySet<string> | null = null

export function setOptimizedImageVariantCatalogForTests(
  paths: Iterable<string> | null
): void {
  catalogOverride = paths === null ? null : new Set(paths)
}

/** Test-only override. Pass `null` to restore the bundled/stub catalog. */
let deployedSourcesOverride: ReadonlySet<string> | null = null

export function setDeployedImageSourcesForTests(
  paths: Iterable<string> | null
): void {
  deployedSourcesOverride = paths === null ? null : new Set(paths)
}

/** Test-only override. Pass `null` to fall back to the environment. */
let imageCdnOverride: boolean | null = null

export function setImageCdnEnabledForTests(enabled: boolean | null): void {
  imageCdnOverride = enabled
}

/**
 * Every variant the CDN can produce for the given width ladder, without
 * consulting a catalog: Netlify clamps each width to the source size, so
 * offering a width wider than the source is safe even though the intrinsic
 * width is unknown here. The ladder defaults to `DEFAULT_CDN_WIDTHS` so ordinary
 * images don't pay for 2560/3840 transforms of clamped, identical output; the
 * hero opts into `TARGET_WIDTHS` for genuine 4K sources.
 *
 * `fullSrc` points at the largest offered width rather than an unsized URL.
 * Both render the same pixels for any source narrower than that width, but an
 * unsized URL is a distinct cache entry and so a second billed transform.
 */
function buildCdnImage(
  source: string,
  widths: readonly number[] = DEFAULT_CDN_WIDTHS
): OptimizedImage {
  const fullWidth = largestTargetWidth(widths)
  return {
    variants: buildImageCdnVariants(source, 'webp', widths),
    fullSrc: buildImageCdnUrl(source, { format: 'webp', width: fullWidth }),
    avifVariants: buildImageCdnVariants(source, 'avif', widths),
    avifFullSrc: buildImageCdnUrl(source, { format: 'avif', width: fullWidth })
  }
}

function optimizedVariantExists(urlPath: string): boolean {
  return (catalogOverride ?? bundledCatalogPaths).has(urlPath)
}

/**
 * Whether a source path ships in the current deploy. In CDN mode the encoder
 * is skipped, so this catalog is the only existence signal; a path absent here
 * (a renamed `/img` asset, or an upload not yet git-synced from the firewalled
 * CMS) must not get a CDN `<picture>` source, because the browser cannot fall
 * back from a 404ing `<source>` and the firewalled origin is unreachable.
 */
function deployedSourceExists(urlPath: string): boolean {
  return (deployedSourcesOverride ?? bundledDeployedSources).has(urlPath)
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
 * Strapi URLs (http://host/uploads/...). Rejects SVGs and GIFs, extensionless
 * paths, anything outside the known source directories, and the generated
 * output tree.
 *
 * Absolute Strapi URLs are reduced to their site-relative pathname: the CMS is
 * firewalled and the site must stay self-contained, so every source has to
 * resolve against our own deploy, never the CMS origin.
 */
function resolveOptimizableSource(src: string): ResolvedImageSource | null {
  // GIFs are excluded like SVGs: encoding to WebP/AVIF (or a CDN fm= transform)
  // would drop animation, so they ship as-is (mirrors scripts/optimize-images.ts).
  if (!src || /\.(svg|gif)$/i.test(src)) return null

  let pathname = src
  if (src.startsWith('http')) {
    try {
      pathname = new URL(src).pathname
    } catch {
      return null
    }
  }

  if (!path.extname(pathname)) return null

  if (isWithinUrlPath(pathname, IMAGE_URL_PATHS.uploadSource)) {
    return { pathname }
  }

  if (
    isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicSource) &&
    !isWithinUrlPath(pathname, IMAGE_URL_PATHS.publicOptimized)
  ) {
    return { pathname }
  }

  return null
}

/** Whether a source is eligible for optimization (used to scope the warning). */
export function isOptimizableSource(src: string): boolean {
  return resolveOptimizableSource(src) !== null
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
 * sources. Every source is gated on the deployed-image-sources catalog: a path
 * not shipped in this deploy (a renamed `/img` asset, or an upload not yet
 * git-synced from the firewalled CMS) returns the empty result so components
 * degrade to a plain `<img>` rather than a 404ing `<picture>` source.
 *
 * In CDN mode the srcset advertises `cdnWidths` (default `DEFAULT_CDN_WIDTHS`).
 * Pass `TARGET_WIDTHS` for a source that genuinely has 4K pixels (the hero) to
 * opt into 2560/3840; the default keeps ordinary images from paying for
 * clamped, byte-identical transforms at those widths. Ignored in build mode,
 * where variants come from the encoder catalog of files that actually exist.
 *
 * CDN URLs already contain percent-encoded query parameter values, so callers
 * must treat them as final URLs: do not run `encodeURI()` or a similar
 * whole-URL escaping pass over the returned strings, or `%2F...` becomes
 * `%252F...` and the CDN source path breaks. See `imageCdn.ts`.
 */
export function getOptimizedImage(
  src: string,
  cdnWidths: readonly number[] = DEFAULT_CDN_WIDTHS
): OptimizedImage {
  const source = resolveOptimizableSource(src)
  if (!source) {
    return { variants: [], fullSrc: null, avifVariants: [], avifFullSrc: null }
  }

  if (imageCdnOverride ?? imageCdnEnabled()) {
    if (!deployedSourceExists(source.pathname)) {
      return {
        variants: [],
        fullSrc: null,
        avifVariants: [],
        avifFullSrc: null
      }
    }
    return buildCdnImage(source.pathname, cdnWidths)
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
