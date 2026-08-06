/**
 * CLI entry point for the build-time image pipeline (`pnpm optimize:images`).
 *
 * Wiring and reporting only — the pipeline itself lives in
 * `scripts/image-optimiser/`, which is unit tested against in-memory doubles.
 */
import path from 'node:path'
import {
  AVIF_QUALITY,
  ConsoleLogger,
  ImageOptimiser,
  NodeFileSystem,
  SharpImageEncoder,
  WEBP_QUALITY,
  createImageOptimiserConfig
} from './image-optimiser/index'

const MILLISECONDS_PER_SECOND = 1000

async function main(): Promise<void> {
  const startTime = Date.now()
  console.log('Optimizing images...\n')

  const config = createImageOptimiserConfig(
    path.resolve(import.meta.dirname, '..')
  )
  const optimiser = new ImageOptimiser(
    {
      fileSystem: new NodeFileSystem(),
      encoder: new SharpImageEncoder({
        webpQuality: WEBP_QUALITY,
        avifQuality: AVIF_QUALITY
      }),
      logger: new ConsoleLogger()
    },
    config
  )

  const summary = await optimiser.run()
  if (summary instanceof Error) {
    // Something an author can fix (an oversized image). The message is the
    // whole story, so print it without a stack trace they can't act on.
    console.error(`\nImage optimization failed: ${summary.message}`)
    process.exit(1)
  }

  const elapsed = ((Date.now() - startTime) / MILLISECONDS_PER_SECOND).toFixed(
    1
  )
  console.log(
    `\nDone in ${elapsed}s — ${summary.sourceCount} images, ${summary.variantsWritten} created, ${summary.cachedCount} cached`
  )
  console.log(
    `Runtime catalog → ${path.relative(config.projectRoot, config.runtimeManifestPath)} (${summary.runtimeVariantCount} variants)`
  )
}

// Unexpected faults (a corrupt source sharp can't decode, a full disk) keep
// their stack — they aren't the author's to fix, they're ours.
main().catch((err) => {
  console.error('Image optimization failed:', err)
  process.exit(1)
})
