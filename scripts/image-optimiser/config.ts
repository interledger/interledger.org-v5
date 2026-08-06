import path from 'node:path'
import {
  AVIF_QUALITY,
  IMAGE_URL_PATHS,
  OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH,
  TARGET_WIDTHS,
  WEBP_QUALITY,
  pathToSegments
} from '@/utils/main/imagePaths'

// Re-exported so the encoder's collaborators have one import for their config.
// Both values are defined in imagePaths.ts, shared with the Netlify Image CDN
// URL builder so the two variant producers cannot drift apart.
export { AVIF_QUALITY, WEBP_QUALITY }

export const AVIF_CHROMA_SUBSAMPLING = '4:4:4'

// Bump when quality, target widths, or output naming changes so the content-hash
// cache does not skip regeneration of already-processed sources.
// `noFull` marks the removal of the duplicate `-full` pair (see planVariants).
export const PIPELINE_ID = `webp${WEBP_QUALITY}-avif${AVIF_QUALITY}-exactWidth-noFull`

// GIFs are excluded: sharp doesn't support multi-frame WebP, so animated GIFs
// would become static. They're passed through as-is by OptimizedImage.
export const RASTER_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif'
])

/** Sits inside the output tree so the cache carries it between builds. */
export const CACHE_MANIFEST_FILE_NAME = '.manifest.json'

export const DEFAULT_CONCURRENCY = 4

/** A directory of source images and where its output is rooted. */
export interface SourceLocation {
  directory: string
  outputPrefix: string
}

export interface ImageOptimiserConfig {
  projectRoot: string
  publicDir: string
  /** Root of the generated variant tree. */
  outputBaseDir: string
  cacheManifestPath: string
  /** Runtime catalog bundled into the SSR function. */
  runtimeManifestPath: string
  sources: SourceLocation[]
  targetWidths: readonly number[]
  pipelineId: string
  concurrency: number
  rasterExtensions: ReadonlySet<string>
}

export function createImageOptimiserConfig(
  projectRoot: string
): ImageOptimiserConfig {
  const publicDir = path.join(projectRoot, 'public')
  const publicAssetPath = (urlPath: string): string =>
    path.join(publicDir, ...pathToSegments(urlPath))
  const outputBaseDir = publicAssetPath(IMAGE_URL_PATHS.publicOptimized)

  return {
    projectRoot,
    publicDir,
    outputBaseDir,
    cacheManifestPath: path.join(outputBaseDir, CACHE_MANIFEST_FILE_NAME),
    runtimeManifestPath: path.join(
      projectRoot,
      OPTIMIZED_IMAGE_MANIFEST_RELATIVE_PATH
    ),
    sources: [
      {
        directory: publicAssetPath(IMAGE_URL_PATHS.publicSource),
        outputPrefix: ''
      },
      {
        directory: publicAssetPath(IMAGE_URL_PATHS.uploadSource),
        outputPrefix: 'uploads'
      }
    ],
    targetWidths: TARGET_WIDTHS,
    pipelineId: PIPELINE_ID,
    concurrency: DEFAULT_CONCURRENCY,
    rasterExtensions: RASTER_EXTENSIONS
  }
}
