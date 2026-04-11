import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const OUTPUT_BASE = path.join(PUBLIC_DIR, 'img', 'optimized')

const TARGET_WIDTHS = [640, 1280, 1920]
const WEBP_QUALITY = 80
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

interface SourceConfig {
  dir: string
  outputPrefix: string
}

const SOURCES: SourceConfig[] = [
  { dir: path.join(PUBLIC_DIR, 'img'), outputPrefix: '' },
  { dir: path.join(PUBLIC_DIR, 'uploads', 'img', 'original'), outputPrefix: 'uploads' },
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

function isFresh(source: string, output: string): boolean {
  if (!fs.existsSync(output)) return false
  return fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs
}

async function processImage(
  filePath: string,
  sourceDir: string,
  outputPrefix: string
): Promise<{ created: number; cached: number }> {
  const relative = path.relative(sourceDir, filePath)
  const { dir, name } = path.parse(relative)
  const outputDir = path.join(OUTPUT_BASE, outputPrefix, dir)

  const metadata = await sharp(filePath).metadata()
  const originalWidth = metadata.width ?? 0
  if (originalWidth === 0) return { created: 0, cached: 0 }

  let created = 0
  let cached = 0

  const widths = TARGET_WIDTHS.filter((w) => w <= originalWidth)

  for (const width of widths) {
    const outPath = path.join(outputDir, `${name}-${width}.webp`)

    if (isFresh(filePath, outPath)) {
      cached++
      continue
    }

    fs.mkdirSync(outputDir, { recursive: true })
    await sharp(filePath)
      .resize(width)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath)
    created++
  }

  const fullPath = path.join(outputDir, `${name}-full.webp`)
  if (isFresh(filePath, fullPath)) {
    cached++
  } else {
    fs.mkdirSync(outputDir, { recursive: true })
    await sharp(filePath).webp({ quality: WEBP_QUALITY }).toFile(fullPath)
    created++
  }

  return { created, cached }
}

async function main(): Promise<void> {
  const startTime = Date.now()
  console.log('Optimizing images...\n')

  let totalCreated = 0
  let totalCached = 0
  let totalFiles = 0

  for (const { dir, outputPrefix } of SOURCES) {
    if (!fs.existsSync(dir)) {
      console.log(`  skip ${path.relative(PROJECT_ROOT, dir)} (not found)`)
      continue
    }

    const files = collectFiles(dir, [OUTPUT_BASE])
    const label = path.relative(PROJECT_ROOT, dir)
    console.log(`  ${label}: ${files.length} raster image(s)`)

    for (const file of files) {
      const { created, cached } = await processImage(file, dir, outputPrefix)
      if (created > 0) {
        console.log(`    ${path.relative(dir, file)} → ${created} new variant(s)`)
      }
      totalCreated += created
      totalCached += cached
      totalFiles++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(
    `\nDone in ${elapsed}s — ${totalFiles} images, ${totalCreated} created, ${totalCached} cached`
  )
}

main().catch((err) => {
  console.error('Image optimization failed:', err)
  process.exit(1)
})
