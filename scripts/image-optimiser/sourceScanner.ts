import path from 'node:path'
import { compareStrings } from './ordering'
import type { DirectoryEntry, FileSystemPort } from './ports'

export interface SourceScannerDependencies {
  fileSystem: FileSystemPort
}

export interface SourceScannerOptions {
  /** Lowercase extensions, including the leading dot. */
  rasterExtensions: ReadonlySet<string>
}

/** Finds encodable source images beneath a directory. */
export class SourceScanner {
  constructor(
    private readonly deps: SourceScannerDependencies,
    private readonly options: SourceScannerOptions
  ) {}

  /**
   * Raster files under `rootDir`, recursively, in a stable order. Directories
   * under any of `excludedDirs` are skipped — the generated output tree lives
   * inside a source tree, so without this the optimiser would re-encode its
   * own variants.
   */
  collect(rootDir: string, excludedDirs: readonly string[]): string[] {
    if (!this.deps.fileSystem.exists(rootDir)) return []

    const files: string[] = []
    for (const entry of this.sortedEntries(rootDir)) {
      const fullPath = path.join(rootDir, entry.name)
      if (entry.isDirectory) {
        if (excludedDirs.some((excluded) => fullPath.startsWith(excluded))) {
          continue
        }
        files.push(...this.collect(fullPath, excludedDirs))
      } else if (this.isRaster(entry.name)) {
        files.push(fullPath)
      }
    }
    return files
  }

  private isRaster(fileName: string): boolean {
    return this.options.rasterExtensions.has(
      path.extname(fileName).toLowerCase()
    )
  }

  /**
   * Sorted so runs, logs, and the manifest don't reorder with readdir order.
   * Codepoint order rather than `localeCompare`, which varies with the host's
   * locale data and would make the output machine-dependent.
   */
  private sortedEntries(dir: string): DirectoryEntry[] {
    return this.deps.fileSystem
      .readDirectory(dir)
      .sort((a, b) => compareStrings(a.name, b.name))
  }
}
