import path from 'node:path'
import stubManifest from '../../generated/optimized-image-manifest.stub.json'
import stubImageSourcesCatalog from '../../generated/deployed-image-sources-catalog.stub.json'
import {
  buildImageCdnUrl,
  buildImageCdnVariants,
  imageCdnEnabled,
  largestTargetWidth,
  type ImageCdnFormat
} from './imageCdn'
import {
  DEFAULT_CDN_WIDTHS,
  IMAGE_URL_PATHS,
  encodeImageUrlPath,
  hasOptimizableRasterExtension,
  type DeployedImageSourcesCatalog,
  type OptimizedImageManifest
} from './imagePaths'

export {
  IMAGE_URL_PATHS,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH,
  TARGET_WIDTHS,
  encodeImageUrlPath,
  hasOptimizableRasterExtension,
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
  /**
   * Site-relative pathname in *literal* form — a space in the filename is a
   * real space, not `%20`. This is catalog space: both catalogs are built from
   * `path.relative(PUBLIC_DIR, …)`, and `buildImageCdnUrl` percent-encodes it
   * once via `URLSearchParams`. Encode with `encodeImageUrlPath` at the moment
   * it becomes a URL, never before.
   */
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

function imageCdnActive(): boolean {
  return imageCdnOverride ?? imageCdnEnabled()
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
 * Strapi URLs (http://host/uploads/...). Rejects anything the encoder cannot
 * produce variants for (SVGs, GIFs, extensionless paths — see
 * `hasOptimizableRasterExtension`), anything outside the known source
 * directories, and the generated output tree.
 *
 * Absolute Strapi URLs are reduced to their site-relative pathname: the CMS is
 * firewalled and the site must stay self-contained, so every source has to
 * resolve against our own deploy, never the CMS origin.
 */
function resolveOptimizableSource(src: string): ResolvedImageSource | null {
  if (!src) return null

  let pathname = src
  if (src.startsWith('http')) {
    try {
      // `URL` hands back a percent-encoded pathname, so decode it: the rest of
      // this module works in literal catalog space, and an absolute CMS URL for
      // `hero image.avif` would otherwise arrive as `hero%20image.avif` and
      // never match the catalog. Malformed escapes throw here and resolve to
      // "not optimizable", which degrades rather than breaking the render.
      pathname = decodeURIComponent(new URL(src).pathname)
    } catch {
      return null
    }
  }

  // Checked against the pathname, not the raw src, so a query string can
  // neither hide an extension nor invent one.
  if (!hasOptimizableRasterExtension(pathname)) return null

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
    // Matched against the literal catalog entry, emitted as a URL.
    variants.push({ src: encodeImageUrlPath(urlPath), width: Number(mid) })
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

  if (imageCdnActive()) {
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
    fullSrc: optimizedVariantExists(fullWebP)
      ? encodeImageUrlPath(fullWebP)
      : null,
    avifVariants,
    avifFullSrc: optimizedVariantExists(fullAvif)
      ? encodeImageUrlPath(fullAvif)
      : null
  }
}

/** Extensions a browser can be served directly, mapped to the `<source>` they belong in. */
const DELIVERABLE_SOURCE_FORMATS: Record<string, ImageCdnFormat> = {
  '.avif': 'avif',
  '.webp': 'webp'
}

/**
 * Rewrites a CDN ladder's top rung to sit exactly at the source's intrinsic
 * width, serving the source file itself when it is already in a deliverable
 * format.
 *
 * Netlify never upscales, so every rung at or above the intrinsic width returns
 * the same full-size pixels — one output behind several cache keys. Worse, that
 * output is still re-encoded: the homepage hero's `w=3840` rung came back 119,495
 * bytes against a 115,274-byte AVIF source at identical dimensions, paying a
 * generation of lossy-on-lossy quality to add bytes. So those rungs collapse into
 * a single canonical one at the intrinsic width, which for an AVIF or WebP source
 * is the file itself (no transform at all) and otherwise an exact-width transform.
 *
 * Rungs below the intrinsic width are genuine downscales and are kept.
 *
 * No-ops outside CDN mode: the build-time encoder already emits the exact
 * intrinsic width and filters target widths against it (see
 * `scripts/optimize-images.ts`). Also no-ops on the empty `OptimizedImage`, so a
 * source missing from this deploy keeps degrading to a plain `<img>` rather than
 * gaining a rung that would 404.
 *
 * Called through `resolveOptimizedImage()`, which every consumer that needs
 * an intrinsic-width rung (`OptimizedImage.astro`, the hero LCP preload
 * builder) goes through — don't call this directly elsewhere.
 */
export function withIntrinsicWidthRung(
  image: OptimizedImage,
  src: string,
  intrinsicWidth: number
): OptimizedImage {
  if (!imageCdnActive() || !hasOptimizedVariants(image)) return image

  const source = resolveOptimizableSource(src)
  if (!source) return image

  const rawFormat =
    DELIVERABLE_SOURCE_FORMATS[path.extname(source.pathname).toLowerCase()]

  const rungFor = (format: ImageCdnFormat): ImageVariant => ({
    // The CDN branch is encoded by `URLSearchParams`; the raw branch is a bare
    // catalog path going straight into a srcset, so it has to be encoded here.
    src:
      rawFormat === format
        ? encodeImageUrlPath(source.pathname)
        : buildImageCdnUrl(source.pathname, { format, width: intrinsicWidth }),
    width: intrinsicWidth
  })

  const downscales = (variants: ImageVariant[]): ImageVariant[] =>
    variants.filter((variant) => variant.width < intrinsicWidth)

  const webpRung = rungFor('webp')
  const avifRung = rungFor('avif')

  return {
    variants: [...downscales(image.variants), webpRung],
    fullSrc: webpRung.src,
    avifVariants: [...downscales(image.avifVariants), avifRung],
    avifFullSrc: avifRung.src
  }
}

/**
 * Resolves a source through `getOptimizedImage`, then collapses its top rung
 * to `intrinsicWidth` when given. The one place that combines the two, so
 * `OptimizedImage.astro` (the real `<picture>`) and the hero LCP preload
 * builder (`heroLcpPreload.ts`) can't resolve the same source differently.
 */
export function resolveOptimizedImage(
  src: string,
  widths?: readonly number[],
  intrinsicWidth?: number
): OptimizedImage {
  const image = getOptimizedImage(src, widths)
  return intrinsicWidth
    ? withIntrinsicWidthRung(image, src, intrinsicWidth)
    : image
}
