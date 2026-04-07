'use strict'

/**
 * Local upload provider: images → uploads/img/optimized/ (hashed names, gitignored),
 * other files → uploads/ (same layout as default local provider).
 *
 * Strapi static root is repo ../public (see config/server.ts).
 */
const fs = require('fs')
const path = require('path')
const stream = require('stream')
const fse = require('fs-extra')
const utils = require('@strapi/utils')
const layoutPaths = require('./layout-paths')

const { PayloadTooLargeError } = utils.errors
const { kbytesToBytes, bytesToHumanReadable } = utils.file

const UPLOADS_FOLDER_NAME = 'uploads'

function isImageMime(mime) {
  return typeof mime === 'string' && mime.startsWith('image/')
}

function relativePathFor(file) {
  if (isImageMime(file.mime)) {
    const posixRel = layoutPaths.optimizedUploadsRelFromStorageName(
      file.name,
      file.hash,
      file.ext
    )
    return path.join(...posixRel.split('/'))
  }
  return `${file.hash}${file.ext}`
}

function urlFromRelative(rel) {
  const posix = rel.split(path.sep).join('/')
  return `/${UPLOADS_FOLDER_NAME}/${posix}`
}

/** Thumbnail / breakpoint uploads keep optimized URLs; only the main asset uses img/original. */
function isDerivativeImageUpload(file) {
  return /^(thumbnail|large|medium|small|xlarge)_/i.test(file.name || '')
}

function stablePublicUrlForMasterImage(file) {
  const rel = layoutPaths.originalMasterUploadsRelFromStorageName(
    file.name || 'image'
  )
  return urlFromRelative(rel)
}

module.exports = {
  init({ sizeLimit: providerOptionsSizeLimit } = {}) {
    if (providerOptionsSizeLimit) {
      process.emitWarning(
        '[deprecated] In future versions, "sizeLimit" argument will be ignored from upload.config.providerOptions. Move it to upload.config'
      )
    }

    const uploadRoot = path.resolve(
      strapi.dirs.static.public,
      UPLOADS_FOLDER_NAME
    )
    if (!fse.pathExistsSync(uploadRoot)) {
      throw new Error(
        `The upload folder (${uploadRoot}) doesn't exist or is not accessible. Please make sure it exists.`
      )
    }

    return {
      checkFileSize(file, options) {
        const { sizeLimit } = options ?? {}
        if (providerOptionsSizeLimit) {
          if (kbytesToBytes(file.size) > providerOptionsSizeLimit) {
            throw new PayloadTooLargeError(
              `${file.name} exceeds size limit of ${bytesToHumanReadable(providerOptionsSizeLimit)}.`
            )
          }
        } else if (sizeLimit) {
          if (kbytesToBytes(file.size) > sizeLimit) {
            throw new PayloadTooLargeError(
              `${file.name} exceeds size limit of ${bytesToHumanReadable(sizeLimit)}.`
            )
          }
        }
      },

      uploadStream(file) {
        if (!file.stream) {
          return Promise.reject(new Error('Missing file stream'))
        }
        const rel = relativePathFor(file)
        const dest = path.join(uploadRoot, rel)
        return fse.ensureDir(path.dirname(dest)).then(
          () =>
            new Promise((resolve, reject) => {
              stream.pipeline(
                file.stream,
                fs.createWriteStream(dest),
                (err) => {
                  if (err) reject(err)
                  else {
                    file.url =
                      isImageMime(file.mime) && !isDerivativeImageUpload(file)
                        ? stablePublicUrlForMasterImage(file)
                        : urlFromRelative(rel)
                    resolve()
                  }
                }
              )
            })
        )
      },

      upload(file) {
        if (!file.buffer) {
          return Promise.reject(new Error('Missing file buffer'))
        }
        const rel = relativePathFor(file)
        const dest = path.join(uploadRoot, rel)
        return fse.ensureDir(path.dirname(dest)).then(
          () =>
            new Promise((resolve, reject) => {
              fs.writeFile(dest, file.buffer, (err) => {
                if (err) reject(err)
                else {
                  file.url =
                    isImageMime(file.mime) && !isDerivativeImageUpload(file)
                      ? stablePublicUrlForMasterImage(file)
                      : urlFromRelative(rel)
                  resolve()
                }
              })
            })
        )
      },

      delete(file) {
        // Only remove provider-managed derivatives under optimized/ (or hashed non-image files).
        // Never delete img/original/: those are git-tracked masters and may be the source for
        // `sync:images`; Strapi media delete / replace must not unlink them.
        const rel = relativePathFor(file)
        const filePath = path.join(uploadRoot, rel)
        return new Promise((resolve, reject) => {
          if (!fs.existsSync(filePath)) {
            resolve("File doesn't exist")
            return
          }
          fs.unlink(filePath, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }
  }
}
