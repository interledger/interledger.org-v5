'use strict'

/**
 * Mirrors cms/src/utils/imageLayoutPaths.ts (plain JS for the upload provider).
 * All originals are flat under img/original/<slug>.<ext> — no subdirectories.
 */
const path = require('path')
const { strings } = require('@strapi/utils')

function slugBase(filenameWithExt) {
  const ext = path.extname(filenameWithExt)
  const base = path.basename(filenameWithExt, ext)
  return strings.nameToSlug(base, { separator: '_', lowercase: false })
}

function originalMasterUploadsRelFromStorageName(storageOrStrapiName) {
  const fileWithExt = path.posix.basename(storageOrStrapiName)
  const ext = path.extname(fileWithExt) || '.bin'
  const slug = slugBase(fileWithExt)
  return path.posix.join('img', 'original', `${slug}${ext}`)
}

function optimizedUploadsRelFromStorageName(storageOrStrapiName, hash, ext) {
  const dotExt = ext && ext.startsWith('.') ? ext : `.${ext || 'bin'}`
  return path.posix.join('img', 'optimized', `${hash}${dotExt}`)
}

module.exports = {
  originalMasterUploadsRelFromStorageName,
  optimizedUploadsRelFromStorageName
}
