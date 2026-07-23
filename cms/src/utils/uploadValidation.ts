import fs from 'fs'
import path from 'path'
import { imageSizeLimitError, isImageOverSizeLimit } from './uploadLimits'

const LOCAL_IMAGE_PREFIXES = ['/img/', '/uploads/'] as const

/** Image extensions eligible for the 2 MB size check (leading-dot form). */
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.tiff'
])

export function isLocalImagePath(url: string): boolean {
  return LOCAL_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))
}

function normalizeExt(ext: string): string {
  const lower = ext.toLowerCase()
  if (!lower) return ''
  return lower.startsWith('.') ? lower : `.${lower}`
}

function isImageUrlPath(urlPath: string): boolean {
  return IMAGE_EXTENSIONS.has(normalizeExt(path.posix.extname(urlPath)))
}

export function resolvePublicImagePath(
  projectRoot: string,
  urlPath: string
): string | Error {
  // Always absolute so containment checks work even if projectRoot is ''
  // (e.g. tests that mock getProjectRoot before setting a temp root).
  const publicDir = path.resolve(projectRoot, 'public')
  const resolved = path.resolve(publicDir, '.' + path.posix.normalize(urlPath))

  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
    return new Error(`Image path escapes public dir: ${urlPath}`)
  }

  return resolved
}

export function validateImageFileSize(filePath: string): Error | null {
  if (!fs.existsSync(filePath)) return null

  const { size } = fs.statSync(filePath)
  if (!isImageOverSizeLimit(size)) return null

  return new Error(imageSizeLimitError(filePath, size))
}

export function validateLocalImageUrl(
  projectRoot: string,
  urlPath: string
): Error | null {
  if (!isLocalImagePath(urlPath)) return null
  // Size limit is image-only — local PDF/video uploads under /uploads/ must pass.
  if (!isImageUrlPath(urlPath)) return null

  const resolved = resolvePublicImagePath(projectRoot, urlPath)
  if (resolved instanceof Error) return resolved

  return validateImageFileSize(resolved)
}
