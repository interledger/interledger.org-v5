import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  AVIF_QUALITY,
  DEPLOYED_IMAGE_SOURCES_CATALOG_RELATIVE_PATH,
  IMAGE_URL_PATHS,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH,
  TARGET_WIDTHS,
  WEBP_QUALITY,
  hasOptimizableRasterExtension,
  pathToSegments,
  type DeployedImageSourcesCatalog,
  type OptimizedImageManifest
} from '@/utils/main/imagePaths'
import { isImageCdnEnabled } from '@/utils/main/imageCdn'
import {
  isImageOverSizeLimit,
  imageSizeLimitError
} from '@/utils/shared/uploadLimits'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const getPublicAssetPath = (urlPath: string): string =>
  path.join(PUBLIC_DIR, ...pathToSegments(urlPath))

const OUTPUT_BASE = getPublicAssetPath(IMAGE_URL_PATHS.publicOptimized)
const MANIFEST_PATH = path.join(OUTPUT_BASE, '.manifest.json')
const RUNTIME_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH
)
const RUNTIME_IMAGE_SOURCES_CATALOG_PATH = path.join(
  PROJECT_ROOT,
  DEPLOYED_IMAGE_SOURCES_CATALOG_RELATIVE_PATH
)

const CONCURRENCY = 4

// WEBP_QUALITY and AVIF_QUALITY now live in @/utils/main/imagePaths so the
// Netlify Image CDN URL builder encodes at the same settings as this script.
// Bump when quality, target widths, or output naming changes so the content-hash
// cache does not skip regeneration of already-processed sources.
const PIPELINE_ID = `webp${WEBP_QUALITY}-avif${AVIF_QUALITY}-exactWidth`

interface SourceConfig {
  dir: string
  outputPrefix: string
}

const SOURCES: SourceConfig[] = [
  {
    dir: getPublicAssetPath(IMAGE_URL_PATHS.publicSource),
    outputPrefix: ''
  },
  {
    dir: getPublicAssetPath(IMAGE_URL_PATHS.uploadSource),
    outputPrefix: 'uploads'
  }
]

function collectFiles(dir: string, exclude: string[]): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (exclude.some((e) => full.startsWith(e))) continue
      results.push(...collectFiles(full, exclude))
    } else if (hasOptimizableRasterExtension(full)) {
      results.push(full)
    }
  }
  return results
}

// Manifest maps source path (relative to project root) → SHA-256 of source content.
// Stored alongside the optimized images so the cache carries it between builds.
// Mtime-based checks are intentionally avoided: git checkout resets source mtimes
// to the current time, making mtime comparisons unreliable in CI environments.
function loadManifest(): Record<string, string> {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Record<
        string,
        string
      >
    }
  } catch {
    // Corrupt or unreadable manifest — rebuild all images.
  }
  return {}
}

function saveManifest(manifest: Record<string, string>): void {
  fs.mkdirSync(OUTPUT_BASE, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

const VARIANT_EXTENSIONS = new Set(['.webp', '.avif'])

// Walks the generated output tree rather than tracking created files inline,
// so variants that were skipped this run (already cached, see loadManifest)
// still end up in the runtime catalog.
function collectVariantPaths(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Hash-cache manifest only — not a public image URL.
    if (entry.name === '.manifest.json') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectVariantPaths(full))
    } else if (VARIANT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const relative = path.relative(PUBLIC_DIR, full).split(path.sep).join('/')
      results.push(`/${relative}`)
    }
  }
  return results
}

/**
 * Bundled into the SSR function via import.meta.glob in images.ts so
 * getOptimizedImage() never needs runtime fs against public/ (INTORG-946).
 * Written next to the committed stub; this path is gitignored.
 */
function saveRuntimeManifest(): void {
  const manifest: OptimizedImageManifest = {
    version: 1,
    variants: collectVariantPaths(OUTPUT_BASE).sort()
  }
  fs.mkdirSync(path.dirname(RUNTIME_MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(
    RUNTIME_MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`
  )
}

/**
 * Bundled into the SSR function via import.meta.glob in images.ts. In CDN mode
 * the encoder is skipped, so this is getOptimizedImage()'s only signal that a
 * source actually ships in this deploy. Covers both committed /img assets and
 * git-synced /uploads originals, so a referenced-but-missing file (a renamed
 * hero, an upload not yet synced from the firewalled CMS) degrades to a plain
 * <img> instead of a 404ing <picture> source. Paths are the site-relative
 * source URLs, taken from the already-scanned batches.
 */
function saveDeployedImageSourcesCatalog(
  batches: Array<{ dir: string; outputPrefix: string; files: string[] }>
): void {
  const sources = batches
    .flatMap((batch) =>
      batch.files.map(
        (file) =>
          `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`
      )
    )
    .sort()
  const catalog: DeployedImageSourcesCatalog = { version: 1, sources }
  fs.mkdirSync(path.dirname(RUNTIME_IMAGE_SOURCES_CATALOG_PATH), {
    recursive: true
  })
  fs.writeFileSync(
    RUNTIME_IMAGE_SOURCES_CATALOG_PATH,
    `${JSON.stringify(catalog, null, 2)}\n`
  )
}

async function hashFile(filePath: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const queue = [...items]
  const results: R[] = []
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!
      results.push(await fn(item))
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return results
}

async function processImage(
  filePath: string,
  sourceDir: string,
  outputPrefix: string
): Promise<number> {
  const relative = path.relative(sourceDir, filePath)
  const { dir, name } = path.parse(relative)
  const outputDir = path.join(OUTPUT_BASE, outputPrefix, dir)
  fs.mkdirSync(outputDir, { recursive: true })

  const metadata = await sharp(filePath).metadata()
  const originalWidth = metadata.width ?? 0
  if (originalWidth === 0) return 0

  let created = 0
  // Always emit a variant at the intrinsic width when it isn't already a target.
  // Otherwise a 1200px original only gets 640 (+ full), and responsive srcsets
  // that omit `-full` force the browser to upscale 640 on desktop (INTORG-934).
  const widthSet = new Set(TARGET_WIDTHS.filter((w) => w <= originalWidth))
  widthSet.add(originalWidth)
  const widths = [...widthSet].sort((a, b) => a - b)

  for (const width of widths) {
    await sharp(filePath)
      .resize(width)
      .webp({ quality: WEBP_QUALITY })
      .toFile(path.join(outputDir, `${name}-${width}.webp`))
    await sharp(filePath)
      .resize(width)
      .avif({ quality: AVIF_QUALITY, chromaSubsampling: '4:4:4' })
      .toFile(path.join(outputDir, `${name}-${width}.avif`))
    created += 2
  }

  await sharp(filePath)
    .webp({ quality: WEBP_QUALITY })
    .toFile(path.join(outputDir, `${name}-full.webp`))
  await sharp(filePath)
    .avif({ quality: AVIF_QUALITY, chromaSubsampling: '4:4:4' })
    .toFile(path.join(outputDir, `${name}-full.avif`))
  created += 2

  return created
}

async function main(): Promise<void> {
  const startTime = Date.now()

  const sourceBatches: Array<{
    dir: string
    outputPrefix: string
    files: string[]
  }> = []
  const oversizedErrors: string[] = []

  for (const { dir, outputPrefix } of SOURCES) {
    if (!fs.existsSync(dir)) {
      console.log(`  skip ${path.relative(PROJECT_ROOT, dir)} (not found)`)
      continue
    }

    const files = collectFiles(dir, [OUTPUT_BASE])
    const label = path.relative(PROJECT_ROOT, dir)
    console.log(`  ${label}: ${files.length} raster image(s)`)

    for (const file of files) {
      const { size } = fs.statSync(file)
      if (isImageOverSizeLimit(size)) {
        oversizedErrors.push(
          imageSizeLimitError(path.relative(PROJECT_ROOT, file), size)
        )
      }
    }

    sourceBatches.push({ dir, outputPrefix, files })
  }

  if (oversizedErrors.length > 0) {
    throw new Error(
      `Found ${oversizedErrors.length} image(s) over the size limit:\n${oversizedErrors
        .map((message) => `  - ${message}`)
        .join('\n')}`
    )
  }

  // The Netlify Image CDN transforms on demand, so pre-generating variants here
  // would be ~17 minutes of build time producing files nothing references.
  // getOptimizedImage() switches to /.netlify/images on the same signal, and
  // the runtime catalog falls back to its committed stub when absent. Oversize
  // checks above still run in this mode so CI keeps enforcing image limits.
  if (isImageCdnEnabled()) {
    // The catalog still ships: it gates the CDN branch for every source so a
    // path missing from this deploy degrades to a plain <img> rather than a
    // 404ing <picture> source. Cheap (paths only, no encoding).
    saveDeployedImageSourcesCatalog(sourceBatches)
    console.log(
      'Netlify Image CDN is enabled — skipping image optimization.\n' +
        'Images are transformed on demand at /.netlify/images.\n' +
        'Set IMAGE_CDN=off to force build-time encoding.'
    )
    return
  }

  console.log('Optimizing images...\n')

  const manifest = loadManifest()
  // Rebuilt from scratch each run — entries for deleted source files are dropped automatically.
  const updatedManifest: Record<string, string> = {}

  let totalCreated = 0
  let totalSkipped = 0
  let totalFiles = 0

  for (const { dir, outputPrefix, files } of sourceBatches) {
    const results = await withConcurrency(
      files,
      CONCURRENCY,
      async (file): Promise<{ created: number; skipped: boolean }> => {
        const manifestKey = path.relative(PROJECT_ROOT, file)
        const hash = await hashFile(file)
        const cacheValue = `${PIPELINE_ID}:${hash}`

        if (manifest[manifestKey] === cacheValue) {
          updatedManifest[manifestKey] = cacheValue
          return { created: 0, skipped: true }
        }

        const created = await processImage(file, dir, outputPrefix)
        updatedManifest[manifestKey] = cacheValue
        if (created > 0) {
          console.log(
            `    ${path.relative(dir, file)} → ${created} new variant(s)`
          )
        }
        return { created, skipped: false }
      }
    )

    for (const { created, skipped } of results) {
      totalCreated += created
      if (skipped) totalSkipped++
      totalFiles++
    }
  }

  saveManifest(updatedManifest)
  saveRuntimeManifest()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(
    `\nDone in ${elapsed}s — ${totalFiles} images, ${totalCreated} created, ${totalSkipped} cached`
  )
  console.log(
    `Runtime catalog → ${path.relative(PROJECT_ROOT, RUNTIME_MANIFEST_PATH)}`
  )
}

main().catch((err) => {
  console.error('Image optimization failed:', err)
  process.exit(1)
})
