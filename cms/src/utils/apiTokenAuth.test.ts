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

  // RFC 7235 section 2.1 makes the scheme name case-insensitive, and Strapi's
  // own api-token middleware accepts every one of these. This route must not be
  // stricter than the rest of the application.
  it.each(['bearer abc123', 'BEARER abc123', 'BeArEr abc123'])(
    'accepts a case-varied scheme: %s',
    (header) => {
      expect(extractBearerToken(header)).toBe('abc123')
    }
  )

  it('accepts more than one space after the scheme', () => {
    expect(extractBearerToken('Bearer     abc123')).toBe('abc123')
  })

  it('accepts a tab after the scheme', () => {
    expect(extractBearerToken('Bearer\tabc123')).toBe('abc123')
  })

  it('ignores leading and trailing whitespace on the header', () => {
    expect(extractBearerToken('  Bearer abc123  ')).toBe('abc123')
  })

  it('still rejects a scheme that only starts with bearer', () => {
    expect(extractBearerToken('Bearerish abc123')).toBeNull()
  })
})

function strapiWith(service: unknown) {
  return {
    service: (uid: string) =>
      uid === 'admin::api-token-content-api' ? service : undefined
  }
}

describe('isFullAccessApiToken', () => {
  it('accepts a full-access token', async () => {
    const hash = vi.fn(() => 'hashed')
    const getByAccessKey = vi.fn(async () => ({
      type: 'full-access',
      kind: 'content-api'
    }))

    await expect(
      isFullAccessApiToken(strapiWith({ hash, getByAccessKey }), 'raw-token')
    ).resolves.toBe(true)

    expect(hash).toHaveBeenCalledWith('raw-token')
    expect(getByAccessKey).toHaveBeenCalledWith('hashed')
  })

  it('accepts a full-access token created before token kinds existed', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => ({ type: 'full-access', kind: null })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(true)
  })

  it('rejects an admin token', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => ({ type: 'full-access', kind: 'admin' })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a read-only token', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => ({ type: 'read-only' })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a custom token', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => ({ type: 'custom' })
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a token with no matching record', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => null
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('rejects a record that carries no type', async () => {
    const strapi = strapiWith({
      hash: () => 'hashed',
      getByAccessKey: async () => ({})
    })
    await expect(isFullAccessApiToken(strapi, 'raw')).resolves.toBe(false)
  })

  it('returns an Error when the token service is missing', async () => {
    const result = await isFullAccessApiToken(strapiWith(undefined), 'raw')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('admin::api-token-content-api')
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
      getByAccessKey: async () => {
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
      getByAccessKey: async () => {
        throw 'string failure'
      }
    })
    const result = await isFullAccessApiToken(strapi, 'raw')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('string failure')
  })
})
