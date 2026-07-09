import { describe, expect, it, vi } from 'vitest'
import { errors } from '@strapi/utils'
import { registerBodyValidationMiddleware } from './index'

function getRegisteredMiddleware(
  pattern: RegExp,
  validate: (body: Record<string, unknown>) => errors.ValidationError | undefined
) {
  const use = vi.fn()
  registerBodyValidationMiddleware({ server: { use } }, pattern, validate)
  return use.mock.calls[0][0] as (
    ctx: {
      method?: string
      url?: string
      request?: { body?: Record<string, unknown> }
      status?: number
      body?: unknown
    },
    next: () => Promise<void>
  ) => Promise<void>

}

describe('registerBodyValidationMiddleware', () => {
  const PATTERN = /^\/content-manager\/collection-types\/api::grant-page\.grant-page/

  it('rejects a matching request with a 400 when validate returns an error, before calling next', async () => {
    const validate = vi.fn(() => new errors.ValidationError('bad primaryCta'))
    const middleware = getRegisteredMiddleware(PATTERN, validate)
    const next = vi.fn()
    const ctx = {
      method: 'PUT',
      url: '/content-manager/collection-types/api::grant-page.grant-page/doc1?locale=en',
      request: { body: { primaryCta: { text: '' } } }
    }

    await middleware(ctx, next)

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({
      data: null,
      error: { status: 400, name: 'ValidationError', message: 'bad primaryCta' }
    })
    expect(next).not.toHaveBeenCalled()
    expect(validate).toHaveBeenCalledWith({ primaryCta: { text: '' } })
  })

  it('calls next without touching the response when validate passes', async () => {
    const validate = vi.fn(() => undefined)
    const middleware = getRegisteredMiddleware(PATTERN, validate)
    const next = vi.fn()
    const ctx = {
      method: 'PUT',
      url: '/content-manager/collection-types/api::grant-page.grant-page/doc1?locale=en',
      request: { body: { primaryCta: { text: 'Apply now', link: 'https://x.com' } } }
    }

    await middleware(ctx, next)

    expect(ctx.status).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('skips validation entirely for a non-matching URL', async () => {
    const validate = vi.fn(() => new errors.ValidationError('should not run'))
    const middleware = getRegisteredMiddleware(PATTERN, validate)
    const next = vi.fn()
    const ctx = {
      method: 'PUT',
      url: '/content-manager/collection-types/api::foundation-page.foundation-page/doc1',
      request: { body: {} }
    }

    await middleware(ctx, next)

    expect(validate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('skips validation for a matching URL on a GET request', async () => {
    const validate = vi.fn(() => new errors.ValidationError('should not run'))
    const middleware = getRegisteredMiddleware(PATTERN, validate)
    const next = vi.fn()
    const ctx = {
      method: 'GET',
      url: '/content-manager/collection-types/api::grant-page.grant-page/doc1',
      request: { body: {} }
    }

    await middleware(ctx, next)

    expect(validate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })
})
