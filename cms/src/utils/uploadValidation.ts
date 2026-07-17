import fs from 'fs'
import path from 'path'
import { imageSizeLimitError, isImageOverSizeLimit } from './uploadLimits'

const LOCAL_IMAGE_PREFIXES = ['/img/', '/uploads/'] as const

export function isLocalImagePath(url: string): boolean {
  return LOCAL_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))
}

export function resolvePublicImagePath(
  projectRoot: string,
  urlPath: string
): string {
  return path.join(projectRoot, 'public', urlPath)
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
  return validateImageFileSize(resolvePublicImagePath(projectRoot, urlPath))
}
