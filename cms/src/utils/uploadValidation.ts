import fs from 'fs'
import path from 'path'
import {
  imageSizeLimitError,
  isImageOverSizeLimit,
  isImagePath
} from './uploadLimits'
import { PATHS } from './paths'

const LOCAL_IMAGE_PREFIXES = ['/img/', '/uploads/'] as const

/** URL prefix of every file the upload provider writes: `PATHS.UPLOADS` as served. */
export const UPLOAD_URL_PREFIX = `/${PATHS.UPLOADS.replace(/^public\//, '')}`

export interface DeletableUploadFile {
  url?: string | null
  hash?: string
  ext?: string
  name?: string
}

function repoImageError(labels: string[]): Error {
  const names = labels.map((label) => `“${label}”`).join(', ')
  const subject =
    labels.length === 1
      ? `${names} is a site image`
      : `${names} are site images`
  return new Error(
    `${subject} stored in the code repository, so it can't be deleted or replaced in Strapi. Upload a new image and use it in your content instead.`
  )
}

function resolveInside(root: string, relativePath: string): string | Error {
  const resolved = path.resolve(root, relativePath)
  if (!resolved.startsWith(root + path.sep)) {
    return new Error(`Upload path escapes the uploads folder: ${relativePath}`)
  }
  return resolved
}

/**
 * The file to unlink when the Media Library deletes or replaces `file`, `null`
 * when there is nothing on disk to remove, or an Error when the file must stay.
 *
 * Only the uploads folder belongs to Strapi. `seedUploadsFromDisk` also lists
 * `public/img/**` so content can use those images, but they are repo-owned:
 * git sync never stages them, so removing one leaves the VM checkout dirty and
 * breaks its next pull, and the Astro code references some of them directly.
 *
 * The URL wins over the hash. Seeded records use the bare filename as their
 * hash, so `/img/foo.png` would otherwise match an unrelated upload `foo.png`.
 */
export function resolveDeletableUploadPath(
  uploadDir: string,
  file: DeletableUploadFile
): string | null | Error {
  const root = path.resolve(uploadDir)
  if (!file.url) {
    return file.hash
      ? resolveInside(root, `${file.hash}${file.ext ?? ''}`)
      : null
  }

  if (!file.url.startsWith(`${UPLOAD_URL_PREFIX}/`)) {
    return repoImageError([file.name || file.url])
  }
  return resolveInside(root, file.url.slice(UPLOAD_URL_PREFIX.length + 1))
}

/**
 * Checks a whole delete batch before any of it is removed. Strapi deletes a
 * batch with one `Promise.all`, so a refusal inside `provider.delete` alone
 * still lets the other files in the batch go. Names every refused file.
 */
export function findUndeletableUploads(
  uploadDir: string,
  files: DeletableUploadFile[]
): Error | null {
  const refused = files.filter(
    (file) => resolveDeletableUploadPath(uploadDir, file) instanceof Error
  )
  if (refused.length === 0) return null
  return repoImageError(refused.map((file) => file.name || file.url || '?'))
}

export function isLocalImagePath(url: string): boolean {
  return LOCAL_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))
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
  if (!isImagePath(urlPath)) return null

  const resolved = resolvePublicImagePath(projectRoot, urlPath)
  if (resolved instanceof Error) return resolved

  return validateImageFileSize(resolved)
}
