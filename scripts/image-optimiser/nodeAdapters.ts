import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { AVIF_CHROMA_SUBSAMPLING } from './config'
import type {
  DirectoryEntry,
  EncodeRequest,
  FileSystemPort,
  ImageEncoderPort,
  LoggerPort
} from './ports'

export class NodeFileSystem implements FileSystemPort {
  exists(targetPath: string): boolean {
    return fs.existsSync(targetPath)
  }

  readDirectory(dirPath: string): DirectoryEntry[] {
    if (!fs.existsSync(dirPath)) return []
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
  }

  async readFileBytes(filePath: string): Promise<Uint8Array> {
    return fs.promises.readFile(filePath)
  }

  readTextFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  }

  writeTextFile(filePath: string, contents: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }

  ensureDirectory(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  fileSizeBytes(filePath: string): number {
    return fs.statSync(filePath).size
  }
}

export interface SharpImageEncoderOptions {
  webpQuality: number
  avifQuality: number
}

export class SharpImageEncoder implements ImageEncoderPort {
  constructor(private readonly options: SharpImageEncoderOptions) {}

  async readIntrinsicWidth(sourcePath: string): Promise<number | null> {
    const { width } = await sharp(sourcePath).metadata()
    return width ?? null
  }

  async encode({
    sourcePath,
    outputPath,
    format,
    width
  }: EncodeRequest): Promise<void> {
    const source = sharp(sourcePath)
    const resized = width === null ? source : source.resize(width)
    const encoded =
      format === 'webp'
        ? resized.webp({ quality: this.options.webpQuality })
        : resized.avif({
            quality: this.options.avifQuality,
            chromaSubsampling: AVIF_CHROMA_SUBSAMPLING
          })
    await encoded.toFile(outputPath)
  }
}

export class ConsoleLogger implements LoggerPort {
  info(message: string): void {
    console.log(message)
  }
}
