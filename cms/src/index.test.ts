import { describe, expect, it, vi } from 'vitest'
import { errors } from '@strapi/utils'
import {
  assertUploadWithinLimit,
  createCheckFileSize,
  registerDocumentValidation
} from './index'

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
