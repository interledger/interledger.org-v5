import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  IMAGE_URL_PATHS,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH,
  TARGET_WIDTHS,
  pathToSegments,
  type OptimizedImageManifest
} from '@/utils/main/imagePaths'

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

const CONCURRENCY = 4

const WEBP_QUALITY = 80
// AVIF at q75 with 4:4:4 chroma subsampling is visually comparable to webp at
// q80 but typically 20-30% smaller, with cleaner dark gradients (no banding).
// Browsers that support AVIF pick it via <source type="image/avif"> ordering.
const AVIF_QUALITY = 75
// GIFs are excluded: sharp doesn't support multi-frame WebP, so animated GIFs
// would become static. They're passed through as-is by OptimizedImage.
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

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

function isRaster(file: string): boolean {
  return RASTER_EXTENSIONS.has(path.extname(file).toLowerCase())
}

function collectFiles(dir: string, exclude: string[]): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (exclude.some((e) => full.startsWith(e))) continue
      results.push(...collectFiles(full, exclude))
    } else if (isRaster(full)) {
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
  const widths = TARGET_WIDTHS.filter((w) => w <= originalWidth)

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
  console.log('Optimizing images...\n')

  const manifest = loadManifest()
  // Rebuilt from scratch each run — entries for deleted source files are dropped automatically.
  const updatedManifest: Record<string, string> = {}

  let totalCreated = 0
  let totalSkipped = 0
  let totalFiles = 0

  for (const { dir, outputPrefix } of SOURCES) {
    if (!fs.existsSync(dir)) {
      console.log(`  skip ${path.relative(PROJECT_ROOT, dir)} (not found)`)
      continue
    }

    const files = collectFiles(dir, [OUTPUT_BASE])
    const label = path.relative(PROJECT_ROOT, dir)
    console.log(`  ${label}: ${files.length} raster image(s)`)

    const results = await withConcurrency(
      files,
      CONCURRENCY,
      async (file): Promise<{ created: number; skipped: boolean }> => {
        const manifestKey = path.relative(PROJECT_ROOT, file)
        const hash = await hashFile(file)

        if (manifest[manifestKey] === hash) {
          updatedManifest[manifestKey] = hash
          return { created: 0, skipped: true }
        }

        const created = await processImage(file, dir, outputPrefix)
        updatedManifest[manifestKey] = hash
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
