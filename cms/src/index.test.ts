import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errors } from '@strapi/utils'
import {
  assertUploadWithinLimit,
  buildLayoutConfiguration,
  createCheckFileSize,
  guardBatchUploadDeletes,
  overrideUploadProvider,
  registerDocumentValidation,
  registerGrantSlugSiblingValidation
} from './index'

describe('buildLayoutConfiguration', () => {
  const edit = [[{ name: 'heading', size: 12 }]]

  it('creates a complete configuration for a new model', () => {
    expect(buildLayoutConfiguration(undefined, edit)).toEqual({
      settings: {},
      metadatas: {},
      layouts: { edit }
    })
  })

  it('preserves existing settings, metadata, list layout, and options', () => {
    const current = {
      settings: { bulkable: true },
      metadatas: { heading: { edit: { label: 'Heading' } } },
      layouts: { list: ['heading'], edit: [] },
      options: { draftAndPublish: false }
    }

    expect(buildLayoutConfiguration(current, edit)).toEqual({
      ...current,
      layouts: { list: ['heading'], edit }
    })
  })

  it('overrides selected settings while preserving the rest', () => {
    const current = {
      settings: { bulkable: true, mainField: 'documentId' }
    }

    expect(
      buildLayoutConfiguration(current, edit, { mainField: 'time' }).settings
    ).toEqual({
      bulkable: true,
      mainField: 'time'
    })
  })
})

function getRegisteredMiddleware(
  uid: string,
  validate: (
    body: Record<string, unknown>
  ) => errors.ValidationError | undefined
) {
  const use = vi.fn()
  registerDocumentValidation({ documents: { use } }, uid, validate)
  return use.mock.calls[0][0] as (
    ctx: {
      uid: string
      action: string
      params: { data?: Record<string, unknown> }
    },
    next: () => Promise<void>
  ) => Promise<void>
}

describe('registerDocumentValidation', () => {
  const UID = 'api::grant-page.grant-page'

  it('rejects a matching document write by throwing the ValidationError, before calling next', async () => {
    const validate = vi.fn(() => new errors.ValidationError('bad primaryCta'))
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()
    const ctx = {
      uid: UID,
      action: 'update',
      params: { data: { primaryCta: { text: '' } } }
    }

    await expect(middleware(ctx, next)).rejects.toThrow('bad primaryCta')

    expect(next).not.toHaveBeenCalled()
    expect(validate).toHaveBeenCalledWith({ primaryCta: { text: '' } })
  })

  it('throws with details.errors[].path intact so the admin can highlight the specific field', async () => {
    const validate = vi.fn(
      () =>
        new errors.ValidationError('Primary Call to Action: Text is required', {
          errors: [
            {
              path: ['primaryCta', 'text'],
              message: 'Primary Call to Action: Text is required',
              name: 'ValidationError'
            }
          ]
        })
    )
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()
    const ctx = {
      uid: UID,
      action: 'create',
      params: { data: { primaryCta: { text: '' } } }
    }

    let thrown: errors.ValidationError | undefined
    try {
      await middleware(ctx, next)
    } catch (err) {
      thrown = err as errors.ValidationError
    }

    expect(thrown?.details.errors).toEqual([
      {
        path: ['primaryCta', 'text'],
        message: 'Primary Call to Action: Text is required',
        name: 'ValidationError'
      }
    ])
  })

  it('calls next without throwing when validate passes', async () => {
    const validate = vi.fn(() => undefined)
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()
    const ctx = {
      uid: UID,
      action: 'update',
      params: {
        data: { primaryCta: { text: 'Apply now', link: 'https://x.com' } }
      }
    }

    await middleware(ctx, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('skips validation when ctx.uid does not match', async () => {
    const validate = vi.fn(() => new errors.ValidationError('should not run'))
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()
    const ctx = {
      uid: 'api::foundation-page.foundation-page',
      action: 'update',
      params: { data: {} }
    }

    await middleware(ctx, next)

    expect(validate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('skips validation for an action other than create/update (e.g. publish)', async () => {
    const validate = vi.fn(() => new errors.ValidationError('should not run'))
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()
    const ctx = {
      uid: UID,
      action: 'publish',
      params: { data: {} }
    }

    await middleware(ctx, next)

    expect(validate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('validates a content-manager-originating write and a public-API-originating write identically, since both produce the same ctx.params.data shape by the time this middleware runs', async () => {
    const validate = vi.fn((body: Record<string, unknown>) =>
      body.ctaStrip
        ? undefined
        : new errors.ValidationError('ctaStrip required')
    )
    const middleware = getRegisteredMiddleware(UID, validate)
    const next = vi.fn()

    // content-manager: documentManager.create/update calls
    // strapi.documents(uid).create/update({ data: sanitizedBody, ... })
    const fromContentManager = {
      uid: UID,
      action: 'update',
      params: { data: { ctaStrip: { heading: 'h' } } }
    }
    await middleware(fromContentManager, next)
    expect(next).toHaveBeenCalledTimes(1)

    // public REST API: core-api controller strips its own `{ data }` envelope
    // before calling strapi.documents(uid).create/update — ctx.params.data
    // ends up the same shape, not a nested `{ data: { data: ... } }`.
    const fromPublicApi = {
      uid: UID,
      action: 'create',
      params: { data: { ctaStrip: { heading: 'h' } } }
    }
    await middleware(fromPublicApi, next)
    expect(next).toHaveBeenCalledTimes(2)
  })
})

describe('assertUploadWithinLimit', () => {
  // Strapi hands the provider a size in kilobytes, not bytes.
  const kb = (bytes: number) => bytes / 1000

  it('rejects an image over 2 MB, naming its real size', () => {
    const file = {
      hash: 'h',
      ext: '.jpg',
      mime: 'image/jpeg',
      name: 'hero.jpg'
    }

    expect(() =>
      assertUploadWithinLimit(
        { ...file, size: kb(3 * 1024 * 1024) },
        'hero.jpg'
      )
    ).toThrow(/hero\.jpg.*3\.00 MB.*2 MB/s)
  })

  it('accepts an image under 2 MB', () => {
    const file = {
      hash: 'h',
      ext: '.jpg',
      mime: 'image/jpeg',
      size: kb(1.5 * 1024 * 1024)
    }

    expect(() => assertUploadWithinLimit(file, 'hero.jpg')).not.toThrow()
  })

  it('holds non-image media to the 5 MB limit instead of the image one', () => {
    const clip = { hash: 'h', ext: '.mp4', mime: 'video/mp4' }

    expect(() =>
      assertUploadWithinLimit(
        { ...clip, size: kb(4 * 1024 * 1024) },
        'clip.mp4'
      )
    ).not.toThrow()
    expect(() =>
      assertUploadWithinLimit(
        { ...clip, size: kb(6 * 1024 * 1024) },
        'clip.mp4'
      )
    ).toThrow(/clip\.mp4.*6\.00 MB.*5 MB/s)
  })

  it('falls back to the buffer length, which is already in bytes', () => {
    const file = {
      hash: 'h',
      ext: '.png',
      mime: 'image/png',
      buffer: Buffer.alloc(3 * 1024 * 1024)
    }

    expect(() => assertUploadWithinLimit(file, 'hero.png')).toThrow(/3\.00 MB/)
  })

  it('defers to the mid-stream check when the size is unknown', () => {
    const file = { hash: 'h', ext: '.png', mime: 'image/png' }

    expect(() => assertUploadWithinLimit(file, 'hero.png')).not.toThrow()
  })
})

describe('createCheckFileSize', () => {
  const oversized = {
    hash: 'h',
    ext: '.jpg',
    mime: 'image/jpeg',
    name: 'hero.jpg',
    size: 3 * 1024
  }

  it('awaits the wrapped check so its rejection propagates', async () => {
    // Regression guard: dropping this promise surfaced as an unhandled
    // rejection that killed the Strapi process (INTORG-1000).
    const original = vi.fn(() =>
      Promise.reject(new errors.PayloadTooLargeError('too big'))
    )
    const checkFileSize = createCheckFileSize(original)
    const withinOurLimits = {
      hash: 'h',
      ext: '.mp4',
      mime: 'video/mp4',
      size: 1
    }

    await expect(checkFileSize(withinOurLimits)).rejects.toThrow('too big')
  })

  it('reports our limit before deferring to the wrapped check', async () => {
    const original = vi.fn(() => Promise.resolve())
    const checkFileSize = createCheckFileSize(original)

    await expect(checkFileSize(oversized)).rejects.toThrow(/2 MB limit/)
    expect(original).not.toHaveBeenCalled()
  })

  it('works when the provider has no size check of its own', async () => {
    await expect(createCheckFileSize()(oversized)).rejects.toThrow(/2 MB limit/)
  })
})

describe('overrideUploadProvider', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  function overrideWithTempPublicDir() {
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-provider-'))
    tempDirs.push(publicDir)
    const provider: Record<string, unknown> = {
      upload: vi.fn(),
      uploadStream: vi.fn(),
      delete: vi.fn(),
      checkFileSize: vi.fn(),
      replace: vi.fn(),
      replaceStream: vi.fn()
    }
    const strapi = {
      plugin: () => ({ provider }),
      dirs: { static: { public: publicDir } },
      log: { info: vi.fn(), warn: vi.fn() }
    } as unknown as Parameters<typeof overrideUploadProvider>[0]
    overrideUploadProvider(strapi)
    return { provider, publicDir }
  }

  // The local provider's replace methods write to public/uploads/ and skip
  // the image size limit. Without them, Strapi replaces a file with delete
  // and upload, which go through this override.
  it('removes the provider replace methods', () => {
    const { provider } = overrideWithTempPublicDir()
    expect(provider.replace).toBeUndefined()
    expect(provider.replaceStream).toBeUndefined()
  })

  it('writes uploads under uploads/img/original', async () => {
    const { provider, publicDir } = overrideWithTempPublicDir()
    const file = {
      hash: 'abc',
      ext: '.txt',
      mime: 'text/plain',
      buffer: Buffer.from('x')
    }
    await (provider.upload as (f: typeof file) => Promise<void>)(file)
    expect(
      fs.existsSync(path.join(publicDir, 'uploads/img/original/abc.txt'))
    ).toBe(true)
    expect((file as { url?: string }).url).toBe('/uploads/img/original/abc.txt')
  })

  function writeFile(publicDir: string, relativePath: string): string {
    const filePath = path.join(publicDir, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, 'x')
    return filePath
  }

  it('deletes an upload by its url', async () => {
    const { provider, publicDir } = overrideWithTempPublicDir()
    const upload = writeFile(publicDir, 'uploads/img/original/abc.png')
    await (provider.delete as (f: object) => Promise<void>)({
      hash: 'abc',
      ext: '.png',
      url: '/uploads/img/original/abc.png'
    })
    expect(fs.existsSync(upload)).toBe(false)
  })

  // public/img is repo-owned and git sync never stages it, so a delete there
  // left the VM checkout dirty and broke its next pull.
  it('refuses to delete a repo image and leaves both files on disk', async () => {
    const { provider, publicDir } = overrideWithTempPublicDir()
    const repoImage = writeFile(publicDir, 'img/logo.png')
    const sameNameUpload = writeFile(publicDir, 'uploads/img/original/logo.png')
    await expect(
      (provider.delete as (f: object) => Promise<void>)({
        hash: 'logo',
        ext: '.png',
        name: 'logo.png',
        url: '/img/logo.png'
      })
    ).rejects.toThrow(/can't be deleted or replaced/)
    // A ForbiddenError reaches the admin as a 403 carrying the message; a
    // plain Error would be a 500 and the editor would never see why.
    await expect(
      (provider.delete as (f: object) => Promise<void>)({
        url: '/img/logo.png'
      })
    ).rejects.toBeInstanceOf(errors.ForbiddenError)
    expect(fs.existsSync(repoImage)).toBe(true)
    expect(fs.existsSync(sameNameUpload)).toBe(true)
  })

  it('ignores an upload that is already gone', async () => {
    const { provider } = overrideWithTempPublicDir()
    await expect(
      (provider.delete as (f: object) => Promise<void>)({
        hash: 'gone',
        ext: '.png',
        url: '/uploads/img/original/gone.png'
      })
    ).resolves.toBeUndefined()
  })
})

describe('guardBatchUploadDeletes', () => {
  const UPLOAD = { id: 1, name: 'a.png', url: '/uploads/img/original/a.png' }
  const REPO_IMAGE = { id: 2, name: 'logo.png', url: '/img/logo.png' }

  function guardWith(records: object[]) {
    const strapiDeleteFiles = vi.fn(async () => records)
    const fileService = { deleteByIds: strapiDeleteFiles }
    const folderService = {
      deleteByIds: vi.fn(
        async (
          _ids: number[],
          options?: { validateFiles?: (files: object[]) => Promise<void> }
        ) => {
          await options?.validateFiles?.(records)
          return {}
        }
      )
    }
    const services: Record<string, object> = {
      file: fileService,
      folder: folderService
    }
    const strapi = {
      plugin: () => ({ service: (name: string) => services[name] }),
      dirs: { static: { public: '/repo/public' } },
      db: { query: () => ({ findMany: async () => records }) },
      log: { info: vi.fn(), warn: vi.fn() }
    } as unknown as Parameters<typeof guardBatchUploadDeletes>[0]
    guardBatchUploadDeletes(strapi)
    return {
      strapiDeleteFiles,
      deleteFiles: fileService.deleteByIds as (
        ids: number[]
      ) => Promise<unknown>,
      deleteFolders: folderService.deleteByIds as (
        ids: number[],
        options?: { validateFiles?: (files: object[]) => Promise<void> }
      ) => Promise<unknown>
    }
  }

  // Strapi removes a batch with one Promise.all, so a refusal per file still
  // let the uploads in the same batch be deleted.
  it('refuses a mixed bulk delete before removing anything', async () => {
    const { deleteFiles, strapiDeleteFiles } = guardWith([UPLOAD, REPO_IMAGE])
    await expect(deleteFiles([1, 2])).rejects.toBeInstanceOf(
      errors.ForbiddenError
    )
    expect(strapiDeleteFiles).not.toHaveBeenCalled()
  })

  it('lets a bulk delete of uploads through', async () => {
    const { deleteFiles } = guardWith([UPLOAD])
    await expect(deleteFiles([1])).resolves.toEqual([UPLOAD])
  })

  it('refuses a folder holding a repo image and keeps the caller check', async () => {
    const { deleteFolders } = guardWith([UPLOAD, REPO_IMAGE])
    const callerCheck = vi.fn(async () => {})
    await expect(
      deleteFolders([9], { validateFiles: callerCheck })
    ).rejects.toThrow(/“logo.png” is a site image/)
    expect(callerCheck).not.toHaveBeenCalled()
  })

  it('runs the caller check for a folder of uploads', async () => {
    const { deleteFolders } = guardWith([UPLOAD])
    const callerCheck = vi.fn(async () => {})
    await deleteFolders([9], { validateFiles: callerCheck })
    expect(callerCheck).toHaveBeenCalledWith([UPLOAD])
  })
})

describe('registerGrantSlugSiblingValidation', () => {
  const GRANT_PAGE = 'api::grant-page.grant-page'
  const OVERVIEW = 'api::grant-overview-page.grant-overview-page'

  type Middleware = (
    ctx: {
      uid: string
      action: string
      params: { data?: Record<string, unknown>; locale?: string }
    },
    next: () => Promise<void>
  ) => Promise<void>

  // A grant page already holds /foo/ in English; overview pages hold nothing.
  function register(isSyncRequest: boolean) {
    const use = vi.fn()
    const findMany = vi.fn(async (options: Record<string, unknown>) =>
      options.locale === 'en' ? [{ documentId: 'g1', pathSlug: '/foo/' }] : []
    )
    const documents = Object.assign(
      vi.fn((uid: string) =>
        uid === GRANT_PAGE
          ? { findMany, findOne: vi.fn(async () => null) }
          : { findMany: vi.fn(async () => []), findOne: vi.fn() }
      ),
      { use }
    )
    registerGrantSlugSiblingValidation({ documents }, () => isSyncRequest)
    const middlewares = use.mock.calls.map(([m]) => m as Middleware)
    return { middlewares, findMany }
  }

  async function saveOverview(middlewares: Middleware[]) {
    const next = vi.fn(async () => {})
    const ctx = {
      uid: OVERVIEW,
      action: 'update',
      params: { data: { pathSlug: '/foo/' }, locale: 'en' }
    }
    for (const middleware of middlewares) await middleware(ctx, next)
    return next
  }

  it('rejects an admin save whose slug the other collection holds', async () => {
    const { middlewares } = register(false)

    await expect(saveOverview(middlewares)).rejects.toThrow(
      'already used by a Grant Page'
    )
  })

  // A commit can move a slug between the collections; the sync may save the
  // new owner first, and must not stop halfway (Jonathan, #867).
  it('lets a sync request through without querying', async () => {
    const { middlewares, findMany } = register(true)

    const next = await saveOverview(middlewares)

    expect(next).toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })
})
