import path from 'node:path'
import type { OptimizedImageManifest } from '@/utils/main/imagePaths'
import { toPosixPath } from './paths'
import type { FileSystemPort } from './ports'
import { VARIANT_FORMATS } from './variantPlan'

const VARIANT_EXTENSIONS: ReadonlySet<string> = new Set(
  VARIANT_FORMATS.map((format) => `.${format}`)
)

export interface RuntimeManifestWriterDependencies {
  fileSystem: FileSystemPort
}

export interface RuntimeManifestWriterOptions {
  /** URLs are written relative to this directory. */
  publicDir: string
  outputBaseDir: string
  manifestPath: string
  /** Cache bookkeeping that lives in the output tree but isn't a public URL. */
  cacheManifestFileName: string
}

/**
 * Writes the runtime variant catalog.
 *
 * Bundled into the SSR function via import.meta.glob in images.ts so
 * getOptimizedImage() never needs runtime fs against public/ (INTORG-946).
 * Written next to the committed stub; that path is gitignored.
 */
export class RuntimeManifestWriter {
  constructor(
    private readonly deps: RuntimeManifestWriterDependencies,
    private readonly options: RuntimeManifestWriterOptions
  ) {}

  write(): OptimizedImageManifest {
    const manifest: OptimizedImageManifest = {
      version: 1,
      variants: this.collectVariantUrls(this.options.outputBaseDir).sort()
    }
    this.deps.fileSystem.writeTextFile(
      this.options.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    return manifest
  }

  /**
   * Walks the generated output tree rather than tracking created files inline,
   * so variants that were skipped this run (already cached) still end up in the
   * catalog.
   */
  private collectVariantUrls(dir: string): string[] {
    if (!this.deps.fileSystem.exists(dir)) return []

    const urls: string[] = []
    for (const entry of this.deps.fileSystem.readDirectory(dir)) {
      if (entry.name === this.options.cacheManifestFileName) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory) {
        urls.push(...this.collectVariantUrls(fullPath))
      } else if (isVariant(entry.name)) {
        urls.push(this.toPublicUrl(fullPath))
      }
    }
    return urls
  }

  private toPublicUrl(fullPath: string): string {
    return `/${toPosixPath(path.relative(this.options.publicDir, fullPath))}`
  }
}

function isVariant(fileName: string): boolean {
  return VARIANT_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}
