export {
  ImageOptimiser,
  type ImageOptimiserDependencies,
  type OptimisationSummary
} from './imageOptimiser'

export {
  AVIF_QUALITY,
  CACHE_MANIFEST_FILE_NAME,
  DEFAULT_CONCURRENCY,
  PIPELINE_ID,
  RASTER_EXTENSIONS,
  WEBP_QUALITY,
  createImageOptimiserConfig,
  type ImageOptimiserConfig,
  type SourceLocation
} from './config'

export {
  CacheManifest,
  CacheManifestStore,
  CACHE_MANIFEST_VERSION,
  type CacheManifestEntry,
  type CacheManifestFile
} from './cacheManifest'

export {
  ConsoleLogger,
  NodeFileSystem,
  SharpImageEncoder,
  type SharpImageEncoderOptions
} from './nodeAdapters'

export { RuntimeManifestWriter } from './runtimeManifest'
export { SourceScanner } from './sourceScanner'
export { mapWithConcurrency } from './concurrency'
export {
  VARIANT_FORMATS,
  planVariants,
  type PlannedVariant,
  type VariantPlan
} from './variantPlan'

export type {
  DirectoryEntry,
  EncodeRequest,
  FileSystemPort,
  ImageEncoderPort,
  LoggerPort,
  VariantFormat
} from './ports'
