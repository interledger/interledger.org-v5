import { describe, expect, it, vi } from 'vitest'
import { extractBearerToken, isFullAccessApiToken } from './apiTokenAuth'

describe('extractBearerToken', () => {
  it('reads the token out of a bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123')
  })

  it('trims surrounding whitespace', () => {
    expect(extractBearerToken('Bearer   abc123  ')).toBe('abc123')
  })

  it('returns null when the header is absent', () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken(null)).toBeNull()
  })

  it('returns null when the header is not a string', () => {
    expect(extractBearerToken(['Bearer abc'])).toBeNull()
    expect(extractBearerToken(42)).toBeNull()
  })

  it('returns null for a non-bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull()
    expect(extractBearerToken('abc123')).toBeNull()
  })

  it('returns null when the bearer carries no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
    expect(extractBearerToken('Bearer    ')).toBeNull()
  })

  // The first version used `.replace('Bearer ', '')`, which stripped the prefix
  // from anywhere in the value and accepted a header that never started with it.
  it('does not strip the prefix from the middle of the value', () => {
    expect(extractBearerToken('Token Bearer abc123')).toBeNull()
  })
})

function strapiWith(service: unknown) {
  return { service: () => service }
}

describe('isFullAccessApiToken', () => {
  it('accepts a full-access token', async () => {
    const hash = vi.fn(() => 'hashed')
    const getBy = vi.fn(async () => ({ type: 'full-access' }))

    await expect(
      isFullAccessApiToken(strapiWith({ hash, getBy }), 'raw-token')
    ).resolves.toBe(true)

    expect(hash).toHaveBeenCalledWith('raw-token')
    expect(getBy).toHaveBeenCalledWith({ accessKey: 'hashed' })
  })

  it('rejects a read-only token', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => ({ type: 'read-only' })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a custom token', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => ({ type: 'custom' })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a token with no matching record', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => null
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a record that carries no type', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => ({})
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('returns an Error when the token service is missing', async () => {
    const result = await isFullAccessApiToken(strapiWith(undefined), 'raw')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('admin::api-token')
  })

  it('returns an Error when the service lacks the methods it needs', async () => {
    const result = await isFullAccessApiToken(
      strapiWith({ hash: () => 'h' }),
      'raw'
    )
    expect(result).toBeInstanceOf(Error)
  })

  // A lookup failure must not read as a rejected token, or a broken database
  // looks like a bad credential.
  it('returns an Error when the lookup throws', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => {
        throw new Error('connection lost')
      }
    })
    const result = await isFullAccessApiToken(strapi, 'raw')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('connection lost')
  })

  it('wraps a non-Error throw', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getBy: async () => {
        throw 'string failure'
      }
    })
    const result = await isFullAccessApiToken(strapi, 'raw')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('string failure')
  })
})
