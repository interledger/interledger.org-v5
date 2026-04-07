/**
 * When an image is uploaded via Strapi, copy the **incoming** multipart file to
 * public/uploads/img/original/ so git can track masters alongside optimized/ derivatives.
 *
 * Uses one filename per slugged basename (overwrite on re-upload — no _1, _2 suffixes).
 */
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { originalMasterUploadsRelFromStorageName } from './imageLayoutPaths'

const copyFile = promisify(fs.copyFile)
const access = promisify(fs.access)

function isImageMime(mimetype: string | undefined): boolean {
  return typeof mimetype === 'string' && mimetype.startsWith('image/')
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Public `/uploads/...` URL for the git-tracked master file — same path as
 * {@link copyIncomingImageOriginal} writes under `img/original/`.
 */
export function originalPublicUrlFromOriginalFilename(
  originalFilename: string
): string {
  const rel = originalMasterUploadsRelFromStorageName(
    originalFilename || 'image'
  )
  return `/uploads/${rel.replace(/\\/g, '/')}`
}

export async function copyIncomingImageOriginal(
  strapi: { dirs: { static: { public: string } } },
  incoming: {
    filepath?: string
    mimetype?: string
    originalFilename?: string
  }
): Promise<void> {
  if (!incoming.filepath || !isImageMime(incoming.mimetype)) return

  const src = incoming.filepath
  if (!(await pathExists(src))) return

  const relUnderUploads = originalMasterUploadsRelFromStorageName(
    incoming.originalFilename || 'image'
  )
  const dest = path.join(
    strapi.dirs.static.public,
    'uploads',
    ...relUnderUploads.split('/').filter(Boolean)
  )
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })

  await copyFile(src, dest)
}

type UploadPayload = {
  files: unknown
}

type StrapiForUploadSplit = {
  dirs: { static: { public: string } }
  plugin: (name: string) => {
    service: (name: string) => {
      upload: (payload: UploadPayload, opts?: unknown) => Promise<unknown>
    }
  }
}

export function patchUploadServiceForOriginalImages(
  strapi: StrapiForUploadSplit
): void {
  const uploadService = strapi.plugin('upload').service('upload') as {
    upload: (payload: UploadPayload, opts?: unknown) => Promise<unknown>
  }
  const originalUpload = uploadService.upload.bind(uploadService)

  uploadService.upload = async (payload: UploadPayload, opts?: unknown) => {
    const files = payload.files
    const list = Array.isArray(files) ? files : [files]
    for (const f of list) {
      if (f && typeof f === 'object' && 'filepath' in f) {
        await copyIncomingImageOriginal(
          strapi,
          f as {
            filepath?: string
            mimetype?: string
            originalFilename?: string
          }
        )
      }
    }
    return originalUpload(payload, opts)
  }
}
