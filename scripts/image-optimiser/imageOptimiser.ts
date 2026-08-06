import crypto from 'node:crypto'
import path from 'node:path'
import {
  imageSizeLimitError,
  isImageOverSizeLimit
} from '@/utils/shared/uploadLimits'
import { CacheManifest, CacheManifestStore } from './cacheManifest'
import { CACHE_MANIFEST_FILE_NAME, type ImageOptimiserConfig } from './config'
import { mapWithConcurrency } from './concurrency'
import { toPosixPath } from './paths'
import type { FileSystemPort, ImageEncoderPort, LoggerPort } from './ports'
import { RuntimeManifestWriter } from './runtimeManifest'
import { SourceScanner } from './sourceScanner'
import { planVariants } from './variantPlan'

export interface ImageOptimiserDependencies {
  fileSystem: FileSystemPort
  encoder: ImageEncoderPort
  logger: LoggerPort
}

export interface OptimisationSummary {
  sourceCount: number
  encodedCount: number
  cachedCount: number
  variantsWritten: number
  /** Variants in the runtime catalog, including ones cached from earlier runs. */
  runtimeVariantCount: number
}

/** One source directory and the images found in it. */
interface SourceBatch {
  directory: string
  outputPrefix: string
  files: string[]
}

interface SourceOutcome {
  variantsWritten: number
  wasCached: boolean
}

/**
 * Generates responsive WebP/AVIF variants for every raster source, skipping
 * sources whose bytes haven't changed since the last run.
 *
 * Collaborators are injected (see `ports.ts`) so the whole pipeline can run
 * against an in-memory filesystem and a fake encoder.
 */
export class ImageOptimiser {
  private readonly scanner: SourceScanner
  private readonly cacheStore: CacheManifestStore
  private readonly runtimeWriter: RuntimeManifestWriter

  constructor(
    private readonly deps: ImageOptimiserDependencies,
    private readonly config: ImageOptimiserConfig
  ) {
    this.scanner = new SourceScanner(
      { fileSystem: deps.fileSystem },
      { rasterExtensions: config.rasterExtensions }
    )
    this.cacheStore = new CacheManifestStore(
      { fileSystem: deps.fileSystem, logger: deps.logger },
      {
        manifestPath: config.cacheManifestPath,
        pipelineId: config.pipelineId
      }
    )
    this.runtimeWriter = new RuntimeManifestWriter(
      { fileSystem: deps.fileSystem },
      {
        publicDir: config.publicDir,
        outputBaseDir: config.outputBaseDir,
        manifestPath: config.runtimeManifestPath,
        cacheManifestFileName: CACHE_MANIFEST_FILE_NAME
      }
    )
  }

  /**
   * Returns an `Error` for the one failure a caller can act on — sources over
   * the upload size limit, reported together rather than one per run. Encoder
   * and filesystem faults reject, since they aren't the author's to fix.
   */
  async run(): Promise<OptimisationSummary | Error> {
    const batches = this.scanSources()

    const oversized = this.findOversizedSources(batches)
    if (oversized.length > 0) return oversizedSourcesError(oversized)

    // Rebuilt from scratch each run, so entries for deleted sources are dropped.
    const previous = this.cacheStore.load()
    const next = CacheManifest.empty(this.config.pipelineId)

    const outcomes: SourceOutcome[] = []
    for (const batch of batches) {
      outcomes.push(
        ...(await mapWithConcurrency(
          batch.files,
          this.config.concurrency,
          (file) => this.optimiseSource(file, batch, previous, next)
        ))
      )
    }

    this.cacheStore.save(next)
    const runtimeManifest = this.runtimeWriter.write()

    return {
      sourceCount: outcomes.length,
      encodedCount: outcomes.filter((outcome) => !outcome.wasCached).length,
      cachedCount: outcomes.filter((outcome) => outcome.wasCached).length,
      variantsWritten: outcomes.reduce(
        (total, outcome) => total + outcome.variantsWritten,
        0
      ),
      runtimeVariantCount: runtimeManifest.variants.length
    }
  }

  private scanSources(): SourceBatch[] {
    const batches: SourceBatch[] = []
    for (const { directory, outputPrefix } of this.config.sources) {
      const label = this.projectRelative(directory)
      if (!this.deps.fileSystem.exists(directory)) {
        this.deps.logger.info(`  skip ${label} (not found)`)
        continue
      }

      const files = this.scanner.collect(directory, [this.config.outputBaseDir])
      this.deps.logger.info(`  ${label}: ${files.length} raster image(s)`)
      batches.push({ directory, outputPrefix, files })
    }
    return batches
  }

  /** Checked before any encoding, so an oversized image fails fast and loudly. */
  private findOversizedSources(batches: SourceBatch[]): string[] {
    const messages: string[] = []
    for (const batch of batches) {
      for (const file of batch.files) {
        const size = this.deps.fileSystem.fileSizeBytes(file)
        if (isImageOverSizeLimit(size)) {
          messages.push(imageSizeLimitError(this.projectRelative(file), size))
        }
      }
    }
    return messages
  }

  private async optimiseSource(
    filePath: string,
    batch: SourceBatch,
    previous: CacheManifest,
    next: CacheManifest
  ): Promise<SourceOutcome> {
    const sourceKey = toPosixPath(this.projectRelative(filePath))
    const hash = sha256Hex(await this.deps.fileSystem.readFileBytes(filePath))

    if (previous.matches(sourceKey, hash)) {
      next.record(sourceKey, hash)
      return { variantsWritten: 0, wasCached: true }
    }

    const variantsWritten = await this.encodeSource(filePath, batch)
    next.record(sourceKey, hash)

    if (variantsWritten > 0) {
      this.deps.logger.info(
        `    ${path.relative(batch.directory, filePath)} → ${variantsWritten} new variant(s)`
      )
    }
    return { variantsWritten, wasCached: false }
  }

  private async encodeSource(
    filePath: string,
    batch: SourceBatch
  ): Promise<number> {
    const relative = path.relative(batch.directory, filePath)
    const { dir, name } = path.parse(relative)

    const intrinsicWidth = await this.deps.encoder.readIntrinsicWidth(filePath)
    const plan = planVariants(
      name,
      intrinsicWidth ?? 0,
      this.config.targetWidths
    )
    if (plan.variants.length === 0) return 0

    const outputDir = path.join(
      this.config.outputBaseDir,
      batch.outputPrefix,
      dir
    )
    this.deps.fileSystem.ensureDirectory(outputDir)

    for (const variant of plan.variants) {
      await this.deps.encoder.encode({
        sourcePath: filePath,
        outputPath: path.join(outputDir, variant.fileName),
        format: variant.format,
        width: variant.width
      })
    }
    return plan.variants.length
  }

  private projectRelative(targetPath: string): string {
    return path.relative(this.config.projectRoot, targetPath)
  }
}

function oversizedSourcesError(messages: string[]): Error {
  const details = messages.map((message) => `  - ${message}`).join('\n')
  return new Error(
    `Found ${messages.length} image(s) over the size limit:\n${details}`
  )
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}
