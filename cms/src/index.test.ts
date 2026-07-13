import { describe, expect, it, vi } from 'vitest'
import { errors } from '@strapi/utils'
import { registerDocumentValidation } from './index'

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
      body.ctaStrip ? undefined : new errors.ValidationError('ctaStrip required')
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
