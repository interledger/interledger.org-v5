import path from 'node:path'
import type {
  DirectoryEntry,
  EncodeRequest,
  FileSystemPort,
  ImageEncoderPort,
  LoggerPort
} from './ports'

/**
 * Filesystem backed by a Map. Directories are implied by the files inside them,
 * plus any created explicitly, so tests only have to declare the files.
 */
export class InMemoryFileSystem implements FileSystemPort {
  private readonly files = new Map<string, Uint8Array>()
  private readonly directories = new Set<string>()

  addFile(filePath: string, contents: string | Uint8Array): this {
    const key = normalise(filePath)
    this.files.set(
      key,
      typeof contents === 'string' ? encode(contents) : contents
    )
    this.markAncestors(key)
    return this
  }

  removeFile(filePath: string): this {
    this.files.delete(normalise(filePath))
    return this
  }

  /** Files present, keyed by path — the assertion surface for writes. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(
      [...this.files].map(([filePath, bytes]) => [filePath, decode(bytes)])
    )
  }

  exists(targetPath: string): boolean {
    const key = normalise(targetPath)
    if (this.files.has(key) || this.directories.has(key)) return true
    return [...this.files.keys()].some((filePath) =>
      filePath.startsWith(`${key}${path.sep}`)
    )
  }

  readDirectory(dirPath: string): DirectoryEntry[] {
    const prefix = `${normalise(dirPath)}${path.sep}`
    const names = new Map<string, boolean>()

    const record = (fullPath: string, isFile: boolean): void => {
      if (!fullPath.startsWith(prefix)) return
      const segments = fullPath.slice(prefix.length).split(path.sep)
      if (segments[0] === '') return
      const isDirectory = segments.length > 1 || !isFile
      names.set(segments[0], names.get(segments[0]) === true || isDirectory)
    }

    for (const filePath of this.files.keys()) record(filePath, true)
    for (const dir of this.directories) record(dir, false)

    return [...names].map(([name, isDirectory]) => ({ name, isDirectory }))
  }

  async readFileBytes(filePath: string): Promise<Uint8Array> {
    const bytes = this.files.get(normalise(filePath))
    if (bytes === undefined) throw new Error(`ENOENT: ${filePath}`)
    return bytes
  }

  readTextFile(filePath: string): string | null {
    const bytes = this.files.get(normalise(filePath))
    return bytes === undefined ? null : decode(bytes)
  }

  writeTextFile(filePath: string, contents: string): void {
    this.addFile(filePath, contents)
  }

  ensureDirectory(dirPath: string): void {
    const key = normalise(dirPath)
    this.directories.add(key)
    this.markAncestors(key)
  }

  fileSizeBytes(filePath: string): number {
    const bytes = this.files.get(normalise(filePath))
    if (bytes === undefined) throw new Error(`ENOENT: ${filePath}`)
    return bytes.byteLength
  }

  private markAncestors(targetPath: string): void {
    let parent = path.dirname(targetPath)
    while (parent !== path.dirname(parent)) {
      this.directories.add(parent)
      parent = path.dirname(parent)
    }
  }
}

/**
 * Stands in for sharp. Widths come from a lookup rather than image bytes, and
 * each encode drops a marker file into the filesystem double so the runtime
 * catalog walk sees real output.
 */
export class FakeImageEncoder implements ImageEncoderPort {
  readonly requests: EncodeRequest[] = []

  constructor(
    private readonly fileSystem: InMemoryFileSystem,
    private readonly intrinsicWidths: ReadonlyMap<string, number>
  ) {}

  async readIntrinsicWidth(sourcePath: string): Promise<number | null> {
    return this.intrinsicWidths.get(normalise(sourcePath)) ?? null
  }

  async encode(request: EncodeRequest): Promise<void> {
    this.requests.push(request)
    this.fileSystem.addFile(
      request.outputPath,
      `${request.format}@${request.width ?? FULL_WIDTH_MARKER}`
    )
  }

  get outputPaths(): string[] {
    return this.requests.map((request) => request.outputPath)
  }
}

const FULL_WIDTH_MARKER = 'full'

export class RecordingLogger implements LoggerPort {
  readonly messages: string[] = []

  info(message: string): void {
    this.messages.push(message)
  }
}

function normalise(targetPath: string): string {
  const normalised = path.normalize(targetPath)
  return normalised.length > 1 && normalised.endsWith(path.sep)
    ? normalised.slice(0, -1)
    : normalised
}

function encode(contents: string): Uint8Array {
  return new TextEncoder().encode(contents)
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
