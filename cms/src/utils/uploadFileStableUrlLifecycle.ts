/**
 * Fallback: rewrite `url` if it still points at `img/optimized/` (e.g. legacy rows or edge cases).
 * The upload provider sets `file.url` to `img/original/...` immediately after writing optimized
 * bytes so CKEditor gets the correct URL in the first API response — this lifecycle is not
 * sufficient on its own for inserts.
 *
 * Also covers **replace** flows that might persist an optimized URL before a follow-up read.
 *
 * On delete: removes the corresponding original from disk and schedules a git sync so that
 * sync:images does not re-import it on the next run.
 */
import fs from 'fs'
import path from 'path'
import { originalPublicUrlFromOriginalFilename } from './uploadSplitImages'
import { originalMasterUploadsRelFromStorageName } from './imageLayoutPaths'
import { scheduleGitSync } from './gitSync'

const FILE_UID = 'plugin::upload.file' as const

type UploadFileRow = {
  id: number
  name: string
  mime?: string | null
  url?: string | null
}

function isMainImage(file: UploadFileRow): boolean {
  return (
    !!file.mime?.startsWith('image/') &&
    !/^(thumbnail|large|medium|small|xlarge)_/i.test(file.name || '')
  )
}

function shouldPointAtOriginalMaster(file: UploadFileRow): boolean {
  return isMainImage(file) && !!file.url?.includes('/uploads/img/optimized/')
}

/** Strip Strapi hash suffix from basename. */
function cleanedStorageName(strapiName: string): string {
  const ext = path.extname(strapiName) || '.bin'
  const base = path.basename(strapiName, ext)
  const cleanedBase = base.replace(/_[a-f0-9]{10}$/i, '')
  return `${cleanedBase}${ext}`
}

export function registerUploadFileStableUrlLifecycle(strapi: {
  dirs: { static: { public: string } }
  db: {
    lifecycles: { subscribe: (sub: Record<string, unknown>) => void }
    query: (uid: string) => {
      update: (args: {
        where: { id: number }
        data: Record<string, unknown>
      }) => Promise<unknown>
    }
  }
  log?: { warn: (msg: string) => void }
}): void {
  async function rewriteIfNeeded(result: UploadFileRow): Promise<void> {
    if (!result?.id || !shouldPointAtOriginalMaster(result)) return
    const url = originalPublicUrlFromOriginalFilename(
      cleanedStorageName(result.name)
    )
    if (url === result.url) return
    try {
      await strapi.db.query(FILE_UID).update({
        where: { id: result.id },
        data: { url }
      })
    } catch (e) {
      strapi.log?.warn(
        `[upload] Could not set stable original URL for file id=${result.id}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  function deleteOriginalIfExists(result: UploadFileRow): void {
    if (!isMainImage(result)) return
    const rel = originalMasterUploadsRelFromStorageName(
      cleanedStorageName(result.name)
    )
    const filePath = path.join(
      strapi.dirs.static.public,
      'uploads',
      ...rel.split('/').filter(Boolean)
    )
    if (!fs.existsSync(filePath)) return
    try {
      fs.unlinkSync(filePath)
      scheduleGitSync(`media: delete ${result.name}`)
    } catch (e) {
      strapi.log?.warn(
        `[upload] Could not delete original for ${result.name}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  strapi.db.lifecycles.subscribe({
    models: [FILE_UID],
    async afterCreate(event) {
      await rewriteIfNeeded(event.result as UploadFileRow)
    },
    async afterUpdate(event) {
      await rewriteIfNeeded(event.result as UploadFileRow)
    },
    afterDelete(event) {
      deleteOriginalIfExists(event.result as UploadFileRow)
    }
  })
}
