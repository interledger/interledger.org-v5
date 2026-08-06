import { compareStrings } from './ordering'
import { toPosixPath } from './paths'
import type { FileSystemPort, LoggerPort } from './ports'

/**
 * Cache manifest — what the optimiser already encoded, so a rerun can skip
 * sources whose bytes are unchanged. Lives inside the output tree so CI cache
 * restores carry it along with the variants it describes.
 *
 * Mtime checks are deliberately avoided: git checkout resets source mtimes to
 * the current time, which makes them meaningless in CI.
 *
 * v2 replaces v1's flat `Record<sourcePath, "pipelineId:sha256">`:
 *   - `version` makes a future format change detectable instead of a silent
 *     misread of someone else's shape.
 *   - `pipelineId` is stored once instead of being concatenated into all ~350
 *     values, so encoder settings are compared as a field rather than by
 *     splitting strings.
 *   - entries are objects, so recording more per source later is additive.
 *   - keys are POSIX-normalised, so the file is portable across platforms.
 *
 * v1 files are migrated on load rather than discarded — a full re-encode costs
 * ~17 minutes of CI, and the hashes in a v1 file are still perfectly good.
 */
export const CACHE_MANIFEST_VERSION = 2

export interface CacheManifestEntry {
  /** SHA-256 of the source file's bytes, hex-encoded. */
  hash: string
}

/** On-disk shape of the cache manifest. */
export interface CacheManifestFile {
  version: typeof CACHE_MANIFEST_VERSION
  pipelineId: string
  /** Keyed by source path relative to the project root, POSIX separators. */
  entries: Record<string, CacheManifestEntry>
}

/**
 * In-memory cache manifest. Pure: parsing, lookups, and serialisation only —
 * reading and writing it is `CacheManifestStore`'s job.
 */
export class CacheManifest {
  private constructor(
    readonly pipelineId: string,
    private readonly entries: Map<string, CacheManifestEntry>
  ) {}

  static empty(pipelineId: string): CacheManifest {
    return new CacheManifest(pipelineId, new Map())
  }

  /**
   * Reads a manifest that is usable by `pipelineId`. Returns an `Error` when
   * the text isn't a manifest at all, and an empty manifest when it is a valid
   * manifest written by a different pipeline (every entry is stale).
   */
  static parse(raw: string, pipelineId: string): CacheManifest | Error {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return new Error(
        `Cache manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    if (!isRecord(parsed)) {
      return new Error('Cache manifest is not a JSON object')
    }
    if (!('version' in parsed)) {
      return CacheManifest.fromLegacy(parsed, pipelineId)
    }
    if (parsed.version !== CACHE_MANIFEST_VERSION) {
      return new Error(
        `Unsupported cache manifest version ${JSON.stringify(parsed.version)} (expected ${CACHE_MANIFEST_VERSION})`
      )
    }
    if (!isRecord(parsed.entries)) {
      return new Error('Cache manifest "entries" is not an object')
    }
    if (parsed.pipelineId !== pipelineId) {
      return CacheManifest.empty(pipelineId)
    }

    return new CacheManifest(pipelineId, readEntries(parsed.entries))
  }

  /**
   * v1: `{ "public/img/a.png": "webp90-avif85-exactWidth:<sha256>" }`.
   *
   * Entries from another pipeline are dropped, as are bare hashes with no
   * pipeline prefix (written before `PIPELINE_ID` existed). Both match what
   * the v1 reader did, which compared the whole concatenated value.
   */
  private static fromLegacy(
    parsed: Record<string, unknown>,
    pipelineId: string
  ): CacheManifest {
    const entries = new Map<string, CacheManifestEntry>()
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue
      // Split on the last colon: the hash is hex, the pipeline id may not be.
      const separator = value.lastIndexOf(':')
      if (separator === -1) continue
      if (value.slice(0, separator) !== pipelineId) continue
      const hash = value.slice(separator + 1)
      if (hash.length > 0) entries.set(toPosixPath(key), { hash })
    }
    return new CacheManifest(pipelineId, entries)
  }

  /** True when this source was encoded from exactly these bytes. */
  matches(sourceKey: string, hash: string): boolean {
    return this.entries.get(sourceKey)?.hash === hash
  }

  record(sourceKey: string, hash: string): void {
    this.entries.set(sourceKey, { hash })
  }

  get size(): number {
    return this.entries.size
  }

  /** Keys sorted so the file doesn't churn with encode completion order. */
  toJSON(): CacheManifestFile {
    const sorted = [...this.entries.entries()].sort(([a], [b]) =>
      compareStrings(a, b)
    )
    return {
      version: CACHE_MANIFEST_VERSION,
      pipelineId: this.pipelineId,
      entries: Object.fromEntries(sorted)
    }
  }

  serialise(): string {
    return `${JSON.stringify(this.toJSON(), null, 2)}\n`
  }
}

export interface CacheManifestStoreDependencies {
  fileSystem: FileSystemPort
  logger: LoggerPort
}

export interface CacheManifestStoreOptions {
  manifestPath: string
  pipelineId: string
}

/** Reads and writes the cache manifest. */
export class CacheManifestStore {
  constructor(
    private readonly deps: CacheManifestStoreDependencies,
    private readonly options: CacheManifestStoreOptions
  ) {}

  /**
   * The previous run's manifest, or an empty one when it is missing or
   * unreadable. An unreadable manifest is not fatal — it only means every
   * source is re-encoded.
   */
  load(): CacheManifest {
    const raw = this.deps.fileSystem.readTextFile(this.options.manifestPath)
    if (raw === null) return CacheManifest.empty(this.options.pipelineId)

    const manifest = CacheManifest.parse(raw, this.options.pipelineId)
    if (manifest instanceof Error) {
      this.deps.logger.info(
        `  cache manifest ignored (${manifest.message}) — re-encoding everything`
      )
      return CacheManifest.empty(this.options.pipelineId)
    }
    return manifest
  }

  save(manifest: CacheManifest): void {
    this.deps.fileSystem.writeTextFile(
      this.options.manifestPath,
      manifest.serialise()
    )
  }
}

function readEntries(
  rawEntries: Record<string, unknown>
): Map<string, CacheManifestEntry> {
  const entries = new Map<string, CacheManifestEntry>()
  for (const [key, value] of Object.entries(rawEntries)) {
    // A malformed entry costs one re-encode; dropping it beats discarding the
    // whole manifest over a single bad row.
    if (!isRecord(value)) continue
    if (typeof value.hash !== 'string' || value.hash.length === 0) continue
    entries.set(toPosixPath(key), { hash: value.hash })
  }
  return entries
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
