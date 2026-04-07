/**
 * All originals live flat under `img/original/<slug>.<ext>` — no subdirectories.
 * Strapi multipart filenames are just the slugged basename; no path encoding needed.
 */
import path from 'path'
import { strings as strapiStrings } from '@strapi/utils'

function slugBase(filenameWithExt: string): string {
  const ext = path.extname(filenameWithExt)
  const base = path.basename(filenameWithExt, ext)
  return strapiStrings.nameToSlug(base, { separator: '_', lowercase: false })
}

/** `a/b/x.jpg` → `x.jpg`; `x.jpg` → `x.jpg` (drop directory, just slugged basename) */
export function storageNameFromRelativeImagePath(
  relativePosix: string
): string {
  const basename =
    relativePosix.split('/').filter(Boolean).pop() ?? relativePosix
  return basename
}

/** Posix path under `uploads/` (no leading slash): `img/original/<slug>.<ext>` */
export function originalMasterUploadsRelFromStorageName(
  storageOrStrapiName: string
): string {
  const fileWithExt = path.posix.basename(storageOrStrapiName)
  const ext = path.extname(fileWithExt) || '.bin'
  const slug = slugBase(fileWithExt)
  return path.posix.join('img', 'original', `${slug}${ext}`)
}

/** `/uploads/img/original/<slug>.<ext>` */
export function originalMasterPublicUrlFromStorageName(
  storageOrStrapiName: string
): string {
  const rel = originalMasterUploadsRelFromStorageName(storageOrStrapiName)
  return `/uploads/${rel}`
}

/** Posix path under `uploads/` for optimized main file: `img/optimized/<hash><ext>` */
export function optimizedUploadsRelFromStorageName(
  _storageOrStrapiName: string,
  hash: string,
  ext: string
): string {
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`
  return path.posix.join('img', 'optimized', `${hash}${dotExt}`)
}
