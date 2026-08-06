/**
 * The seams between the optimiser and the outside world.
 *
 * Every filesystem read, sharp encode, and console write goes through one of
 * these interfaces, so the pipeline can be driven end to end by in-memory
 * doubles (see `testDoubles.ts`) without touching disk or spawning libvips.
 * Node/sharp implementations live in `nodeAdapters.ts`.
 */

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}

export interface FileSystemPort {
  exists(targetPath: string): boolean
  /** Entries of `dirPath`, or an empty array when it does not exist. */
  readDirectory(dirPath: string): DirectoryEntry[]
  readFileBytes(filePath: string): Promise<Uint8Array>
  /** File contents, or `null` when the file does not exist. */
  readTextFile(filePath: string): string | null
  /** Writes `contents`, creating parent directories as needed. */
  writeTextFile(filePath: string, contents: string): void
  ensureDirectory(dirPath: string): void
  fileSizeBytes(filePath: string): number
}

export type VariantFormat = 'webp' | 'avif'

export interface EncodeRequest {
  sourcePath: string
  outputPath: string
  format: VariantFormat
  /** Never exceeds the source's intrinsic width, so this is only ever a downscale. */
  width: number
}

export interface ImageEncoderPort {
  /** Intrinsic width in pixels, or `null` when the source has no readable width. */
  readIntrinsicWidth(sourcePath: string): Promise<number | null>
  encode(request: EncodeRequest): Promise<void>
}

export interface LoggerPort {
  info(message: string): void
}
