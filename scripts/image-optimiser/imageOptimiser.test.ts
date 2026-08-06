import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '@/utils/shared/uploadLimits'
import { CACHE_MANIFEST_VERSION } from './cacheManifest'
import {
  PIPELINE_ID,
  createImageOptimiserConfig,
  type ImageOptimiserConfig
} from './config'
import { ImageOptimiser, type OptimisationSummary } from './imageOptimiser'
import {
  FakeImageEncoder,
  InMemoryFileSystem,
  RecordingLogger
} from './testDoubles'

const PROJECT_ROOT = '/project'
const PUBLIC_IMG = `${PROJECT_ROOT}/public/img`
const UPLOADS_IMG = `${PROJECT_ROOT}/public/uploads/img/original`
const OUTPUT_DIR = `${PUBLIC_IMG}/optimized`

interface ImageOptions {
  width?: number
  contents?: string | Uint8Array
}

function createHarness() {
  const fileSystem = new InMemoryFileSystem()
  const intrinsicWidths = new Map<string, number>()
  const baseConfig = createImageOptimiserConfig(PROJECT_ROOT)

  let encoder = new FakeImageEncoder(fileSystem, intrinsicWidths)
  let logger = new RecordingLogger()

  return {
    fileSystem,
    config: baseConfig,
    get encoder() {
      return encoder
    },
    get logger() {
      return logger
    },

    addImage(absolutePath: string, options: ImageOptions = {}): void {
      fileSystem.addFile(absolutePath, options.contents ?? 'source-bytes')
      if (options.width !== undefined) {
        intrinsicWidths.set(absolutePath, options.width)
      }
    },

    /** Fresh encoder and logger per run, so a rerun's calls stand alone. */
    async run(
      overrides: Partial<ImageOptimiserConfig> = {}
    ): Promise<OptimisationSummary | Error> {
      encoder = new FakeImageEncoder(fileSystem, intrinsicWidths)
      logger = new RecordingLogger()
      return new ImageOptimiser(
        { fileSystem, encoder, logger },
        {
          ...baseConfig,
          ...overrides
        }
      ).run()
    }
  }
}

type Harness = ReturnType<typeof createHarness>

async function runOrThrow(
  harness: Harness,
  overrides: Partial<ImageOptimiserConfig> = {}
): Promise<OptimisationSummary> {
  const summary = await harness.run(overrides)
  if (summary instanceof Error) throw summary
  return summary
}

function sha256Of(contents: string): string {
  return crypto
    .createHash('sha256')
    .update(new TextEncoder().encode(contents))
    .digest('hex')
}

function readJson(fileSystem: InMemoryFileSystem, filePath: string): unknown {
  const raw = fileSystem.readTextFile(filePath)
  if (raw === null) throw new Error(`Expected a file at ${filePath}`)
  return JSON.parse(raw)
}

describe('ImageOptimiser — encoding', () => {
  it('encodes every source and reports what it did', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 1200 })
    harness.addImage(`${UPLOADS_IMG}/logo.png`, { width: 500 })

    const summary = await runOrThrow(harness)

    // hero: 640 + 1200, logo: 500 — two formats each.
    expect(summary).toEqual({
      sourceCount: 2,
      encodedCount: 2,
      cachedCount: 0,
      variantsWritten: 6,
      runtimeVariantCount: 6
    })
  })

  it('writes upload variants under the uploads prefix and mirrors subdirectories', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/blog/2026-01/cover.jpg`, { width: 640 })
    harness.addImage(`${UPLOADS_IMG}/team/avatar.png`, { width: 640 })

    await runOrThrow(harness)

    expect(harness.encoder.outputPaths).toEqual([
      `${OUTPUT_DIR}/blog/2026-01/cover-640.webp`,
      `${OUTPUT_DIR}/blog/2026-01/cover-640.avif`,
      `${OUTPUT_DIR}/uploads/team/avatar-640.webp`,
      `${OUTPUT_DIR}/uploads/team/avatar-640.avif`
    ])
  })

  it('resizes to each target width and writes no duplicate full-size pair', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 1200 })

    await runOrThrow(harness)

    expect(
      harness.encoder.requests.map(({ format, width }) => ({ format, width }))
    ).toEqual([
      { format: 'webp', width: 640 },
      { format: 'avif', width: 640 },
      { format: 'webp', width: 1200 },
      { format: 'avif', width: 1200 }
    ])
    expect(harness.encoder.outputPaths).not.toContain(
      `${OUTPUT_DIR}/hero-full.webp`
    )
  })

  it('never treats its own output as a source', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    harness.fileSystem.addFile(`${OUTPUT_DIR}/stale-640.webp`, 'from-last-run')

    await runOrThrow(harness)

    expect(
      harness.encoder.requests.map((request) => request.sourcePath)
    ).not.toContain(`${OUTPUT_DIR}/stale-640.webp`)
  })

  it('records a source with no readable width instead of retrying it forever', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/corrupt.png`)

    const first = await runOrThrow(harness)
    expect(first).toMatchObject({ encodedCount: 1, variantsWritten: 0 })
    expect(harness.encoder.requests).toEqual([])

    const second = await runOrThrow(harness)
    expect(second).toMatchObject({ cachedCount: 1, encodedCount: 0 })
  })
})

describe('ImageOptimiser — caching', () => {
  it('skips sources whose bytes have not changed', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    await runOrThrow(harness)

    const summary = await runOrThrow(harness)

    expect(harness.encoder.requests).toEqual([])
    expect(summary).toEqual({
      sourceCount: 1,
      encodedCount: 0,
      cachedCount: 1,
      variantsWritten: 0,
      // Cached variants stay in the catalog — it is built from the output tree.
      runtimeVariantCount: 2
    })
  })

  it('re-encodes a source whose bytes changed', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    harness.addImage(`${PUBLIC_IMG}/untouched.png`, { width: 640 })
    await runOrThrow(harness)

    harness.addImage(`${PUBLIC_IMG}/hero.png`, {
      width: 640,
      contents: 'edited-bytes'
    })
    const summary = await runOrThrow(harness)

    expect(summary).toMatchObject({ encodedCount: 1, cachedCount: 1 })
    expect(
      new Set(harness.encoder.requests.map((request) => request.sourcePath))
    ).toEqual(new Set([`${PUBLIC_IMG}/hero.png`]))
  })

  it('re-encodes everything when the encoder settings change', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    await runOrThrow(harness)

    const summary = await runOrThrow(harness, { pipelineId: 'webp100-avif95' })

    expect(summary).toMatchObject({ encodedCount: 1, cachedCount: 0 })
  })

  it('reuses a v1 manifest instead of paying for a full re-encode', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    harness.fileSystem.addFile(
      harness.config.cacheManifestPath,
      JSON.stringify({
        'public/img/hero.png': `${PIPELINE_ID}:${sha256Of('source-bytes')}`
      })
    )

    const summary = await runOrThrow(harness)

    expect(summary).toMatchObject({ encodedCount: 0, cachedCount: 1 })
    expect(harness.encoder.requests).toEqual([])
  })

  it('drops deleted sources from the manifest', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/keep.png`, { width: 640 })
    harness.addImage(`${PUBLIC_IMG}/remove.png`, { width: 640 })
    await runOrThrow(harness)

    harness.fileSystem.removeFile(`${PUBLIC_IMG}/remove.png`)
    await runOrThrow(harness)

    expect(
      readJson(harness.fileSystem, harness.config.cacheManifestPath)
    ).toMatchObject({ entries: { 'public/img/keep.png': expect.anything() } })
    expect(
      Object.keys(
        (
          readJson(harness.fileSystem, harness.config.cacheManifestPath) as {
            entries: Record<string, unknown>
          }
        ).entries
      )
    ).toEqual(['public/img/keep.png'])
  })
})

describe('ImageOptimiser — manifests', () => {
  it('writes a v2 cache manifest keyed by project-relative source path', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    harness.addImage(`${UPLOADS_IMG}/logo.png`, {
      width: 640,
      contents: 'logo-bytes'
    })

    await runOrThrow(harness)

    expect(
      readJson(harness.fileSystem, harness.config.cacheManifestPath)
    ).toEqual({
      version: CACHE_MANIFEST_VERSION,
      pipelineId: PIPELINE_ID,
      entries: {
        'public/img/hero.png': { hash: sha256Of('source-bytes') },
        'public/uploads/img/original/logo.png': { hash: sha256Of('logo-bytes') }
      }
    })
  })

  it('writes the runtime catalog as sorted public URLs', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })
    harness.addImage(`${UPLOADS_IMG}/logo.png`, { width: 640 })

    await runOrThrow(harness)

    expect(
      readJson(harness.fileSystem, harness.config.runtimeManifestPath)
    ).toEqual({
      version: 1,
      variants: [
        '/img/optimized/hero-640.avif',
        '/img/optimized/hero-640.webp',
        '/img/optimized/uploads/logo-640.avif',
        '/img/optimized/uploads/logo-640.webp'
      ]
    })
  })

  it('keeps the cache manifest out of the runtime catalog', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/hero.png`, { width: 640 })

    const summary = await runOrThrow(harness)

    expect(summary.runtimeVariantCount).toBe(2)
  })
})

describe('ImageOptimiser — failure and edge cases', () => {
  it('reports every oversized source at once and encodes nothing', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/huge.png`, {
      width: 4000,
      contents: new Uint8Array(MAX_IMAGE_BYTES + 1)
    })
    harness.addImage(`${UPLOADS_IMG}/also-huge.png`, {
      width: 4000,
      contents: new Uint8Array(MAX_IMAGE_BYTES + 1)
    })
    harness.addImage(`${PUBLIC_IMG}/fine.png`, { width: 640 })

    const result = await harness.run()

    expect(result).toBeInstanceOf(Error)
    const { message } = result as Error
    expect(message).toContain('Found 2 image(s) over the size limit')
    expect(message).toContain('public/img/huge.png')
    expect(message).toContain('public/uploads/img/original/also-huge.png')
    expect(message).not.toContain('fine.png')
    expect(harness.encoder.requests).toEqual([])
  })

  it('leaves both manifests untouched when a source is oversized', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/huge.png`, {
      width: 4000,
      contents: new Uint8Array(MAX_IMAGE_BYTES + 1)
    })

    await harness.run()

    expect(
      harness.fileSystem.readTextFile(harness.config.cacheManifestPath)
    ).toBeNull()
    expect(
      harness.fileSystem.readTextFile(harness.config.runtimeManifestPath)
    ).toBeNull()
  })

  it('carries on when a source directory is missing', async () => {
    const harness = createHarness()
    harness.addImage(`${UPLOADS_IMG}/logo.png`, { width: 640 })

    const summary = await runOrThrow(harness)

    expect(summary).toMatchObject({ sourceCount: 1, encodedCount: 1 })
    expect(harness.logger.messages).toContain('  skip public/img (not found)')
  })

  it('produces an empty catalog rather than failing when there is nothing to do', async () => {
    const harness = createHarness()

    const summary = await runOrThrow(harness)

    expect(summary).toEqual({
      sourceCount: 0,
      encodedCount: 0,
      cachedCount: 0,
      variantsWritten: 0,
      runtimeVariantCount: 0
    })
  })

  it('logs a count per source directory and a line per encoded image', async () => {
    const harness = createHarness()
    harness.addImage(`${PUBLIC_IMG}/blog/cover.png`, { width: 640 })

    await runOrThrow(harness)

    expect(harness.logger.messages).toContain('  public/img: 1 raster image(s)')
    expect(harness.logger.messages).toContain(
      '    blog/cover.png → 2 new variant(s)'
    )
  })
})
