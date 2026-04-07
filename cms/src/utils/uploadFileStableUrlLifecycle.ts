/**
 * Fallback: rewrite `url` if it still points at `img/optimized/` (e.g. legacy rows or edge cases).
 * The upload provider sets `file.url` to `img/original/...` immediately after writing optimized
 * bytes so CKEditor gets the correct URL in the first API response — this lifecycle is not
 * sufficient on its own for inserts.
 *
 * Also covers **replace** flows that might persist an optimized URL before a follow-up read.
 */
import path from 'path'
import { originalPublicUrlFromOriginalFilename } from './uploadSplitImages'

const FILE_UID = 'plugin::upload.file' as const

type UploadFileRow = {
  id: number
  name: string
  mime?: string | null
  url?: string | null
}

function shouldPointAtOriginalMaster(file: UploadFileRow): boolean {
  if (
    !file.mime?.startsWith('image/') ||
    !file.url?.includes('/uploads/img/optimized/')
  ) {
    return false
  }
  // Thumbnails / breakpoints keep optimized URLs
  if (/^(thumbnail|large|medium|small|xlarge)_/i.test(file.name || '')) {
    return false
  }
  return true
}

/** Strip Strapi hash suffix from basename. */
function cleanedStorageName(strapiName: string): string {
  const ext = path.extname(strapiName) || '.bin'
  const base = path.basename(strapiName, ext)
  const cleanedBase = base.replace(/_[a-f0-9]{10}$/i, '')
  return `${cleanedBase}${ext}`
}

export function registerUploadFileStableUrlLifecycle(strapi: {
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

  strapi.db.lifecycles.subscribe({
    models: [FILE_UID],
    async afterCreate(event) {
      await rewriteIfNeeded(event.result as UploadFileRow)
    },
    async afterUpdate(event) {
      await rewriteIfNeeded(event.result as UploadFileRow)
    }
  })
}
